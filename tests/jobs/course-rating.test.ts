import { describe, expect, it, vi } from "vitest";
import { AiBudget } from "@/ai/budget";
import { AiCompletionError, type AiUsage } from "@/ai/claude-call";
import type { RatingReader, SgtCard } from "@/ai/rating-reader";
import { COURSE_RATING_JOB } from "@/jobs/course-rating";
import { createJobHandlers } from "@/jobs/ocr-scorecard";
import { enqueueJob } from "@/jobs/queue";
import { runNextJob } from "@/jobs/runner";
import { SgtClient } from "@/server/courses/sgt";
import { referenceCard } from "../factories";
import { BETHPAGE_TEES, SGT_COURSES_HTML, SGT_SCORECARD_30 } from "../sgt";
import { freshTestDb, jobRow, NOW } from "./helpers";

const COURSES_URL = "https://simulatorgolftour.com/courses";
const SCORECARD_30_URL =
  "https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_30.jpg";

const BETHPAGE_CARD: SgtCard = { par: 71, tees: BETHPAGE_TEES };

/** Usage mesuré en 3.5 sur `scorecard_30.jpg` : 1 352 × 4 + 128 × 20 = 7 968 µ$. */
const USAGE: AiUsage = { model: "claude-opus-5-5", inputTokens: 1352, outputTokens: 128 };

const PAR_72 = Array.from({ length: 18 }, () => 4);

const testDb = freshTestDb();

/** Round sur `courseName` / `tees` avec ses pars, sans passer par `saveRound`. */
function insertRound(courseName: string, tees: string, pars: readonly number[]) {
  const { sqlite } = testDb();
  const { lastInsertRowid } = sqlite
    .prepare(
      "INSERT INTO rounds (course_name, tees, played_on, created_at) VALUES (?, ?, '2026-10-17', ?)",
    )
    .run(courseName, tees, NOW.getTime());
  const hole = sqlite.prepare(
    "INSERT INTO round_holes (round_id, hole, par, stroke_index) VALUES (?, ?, ?, ?)",
  );
  pars.forEach((par, i) => {
    hole.run(lastInsertRowid, i + 1, par, i + 1);
  });
}

type RatingRow = {
  ratingT?: number | null;
  slope?: number | null;
  source?: string | null;
  status?: string;
  sgtCourseId?: number | null;
  sgtCourseName?: string | null;
  sgtCourseLocation?: string | null;
};

/** Ligne de `course_ratings` (`pending` par défaut), et son id. */
function insertRating(courseName: string, tees: string, row: RatingRow = {}): number {
  const { lastInsertRowid } = testDb()
    .sqlite.prepare(
      `INSERT INTO course_ratings (course_name, tees, rating_t, slope, source, status, sgt_course_id,
                                   sgt_course_name, sgt_course_location, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      courseName,
      tees,
      row.ratingT ?? null,
      row.slope ?? null,
      row.source ?? null,
      row.status ?? "pending",
      row.sgtCourseId ?? null,
      row.sgtCourseName ?? null,
      row.sgtCourseLocation ?? null,
    );
  return Number(lastInsertRowid);
}

/** Paire du round de référence : « BETHPAGE BLACK » (par 71) et ses tees. */
function bethpage(tees = "Red", row: RatingRow = {}): number {
  insertRound("BETHPAGE BLACK", tees, referenceCard.pars);
  return insertRating("BETHPAGE BLACK", tees, row);
}

type StoredRating = {
  status: string;
  note: string | null;
  sgtCourseId: number | null;
  sgtCourseName: string | null;
  sgtCourseLocation: string | null;
  candidates: unknown;
  teesRead: unknown;
  proposedTee: string | null;
  ratingT: number | null;
  slope: number | null;
  source: string | null;
};

/** Ligne `id` de `course_ratings`, colonnes JSON décodées. */
function ratingRow(id: number): StoredRating {
  const row = testDb()
    .sqlite.prepare(
      `SELECT status, note, sgt_course_id AS sgtCourseId, sgt_course_name AS sgtCourseName,
              sgt_course_location AS sgtCourseLocation, candidates, tees_read AS teesRead,
              proposed_tee AS proposedTee, rating_t AS ratingT, slope, source
       FROM course_ratings WHERE id = ?`,
    )
    .get(id) as StoredRating & { candidates: string | null; teesRead: string | null };
  return {
    ...row,
    candidates: row.candidates && JSON.parse(row.candidates),
    teesRead: row.teesRead && JSON.parse(row.teesRead),
  };
}

const aiUsageRows = () =>
  testDb()
    .sqlite.prepare(
      `SELECT month, model, input_tokens AS inputTokens, output_tokens AS outputTokens,
              cost_micro_usd AS costMicroUsd FROM ai_usage`,
    )
    .all();

type SgtMode = "up" | "down" | "scorecard-503";

/** SGT simulé sur les fixtures : `down` rejette comme un réseau coupé. */
function fakeSgt(mode: SgtMode = "up") {
  const urls: string[] = [];
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    if (mode === "down") throw new TypeError("fetch failed");
    if (url === COURSES_URL) return new Response(SGT_COURSES_HTML);
    if (url === SCORECARD_30_URL && mode === "up")
      return new Response(new Uint8Array(SGT_SCORECARD_30));
    return new Response("", { status: mode === "scorecard-503" ? 503 : 404 });
  }) as typeof globalThis.fetch;
  return { client: new SgtClient({ fetch }), urls };
}

/** Lecteur IA simulé : rend `result`, ou lève `result` si c'est une erreur. */
function fakeReader(result: SgtCard | null | Error = BETHPAGE_CARD) {
  const images: Buffer[] = [];
  const reader: RatingReader = {
    async read(scorecard) {
      images.push(scorecard);
      if (result instanceof Error) throw result;
      return { card: result, usage: USAGE };
    },
  };
  return { reader, images };
}

/** Budget IA de 1 $ dont `spentMicroUsd` sont déjà dépensés en octobre 2026. */
function budget(spentMicroUsd = 0) {
  const ai = new AiBudget(testDb().db, 1, "America/Montreal");
  if (spentMicroUsd > 0)
    ai.record(
      { model: "claude-opus-5-5", inputTokens: 0, outputTokens: 0, costMicroUsd: spentMicroUsd },
      NOW,
    );
  return ai;
}

type RunOptions = {
  sgt?: ReturnType<typeof fakeSgt>;
  reader?: RatingReader | null;
  spentMicroUsd?: number;
  lookup?: boolean;
  attempts?: number;
};

/** Met en file la recherche de la ligne `id` et fait tourner le worker `attempts` fois. */
async function search(id: number, options: RunOptions = {}) {
  const { sgt = fakeSgt(), reader = fakeReader().reader, lookup = true, attempts = 1 } = options;
  const ai = reader ? { reader, budget: budget(options.spentMicroUsd) } : null;
  const { db } = testDb();
  const handlers = createJobHandlers(db, testDb().dir, {
    now: () => NOW,
    courseRating: { sgt: sgt.client, ai, lookup },
  });
  enqueueJob(db, COURSE_RATING_JOB, { courseRatingId: id }, NOW);
  for (let i = 0; i < attempts; i++) await runNextJob(db, handlers, NOW);
}

describe("gestionnaire course-rating", () => {
  // Spec « Proposition pour Bethpage Black ». Mutations : `proposed_tee` pris sur le premier
  // tee lu (Blue), rating de la proposition écrite dans `rating_t` / `slope`, nom ou lieu SGT
  // du parcours retenu non écrits.
  it("propose le tee Red de Bethpage Black (30) sans écrire rating_t ni slope", async () => {
    const id = bethpage("Red");
    await search(id);
    expect(ratingRow(id)).toEqual({
      status: "proposed",
      note: null,
      sgtCourseId: 30,
      sgtCourseName: "Bethpage Black",
      sgtCourseLocation: "Farmingdale, NY",
      candidates: null,
      teesRead: BETHPAGE_TEES,
      proposedTee: "Red",
      ratingT: null,
      slope: null,
      source: null,
    });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });

  // Spec : l'image envoyée à l'IA est celle de SGT seule. Mutation : lire une autre image.
  it("envoie à l'IA la carte SGT du parcours telle que téléchargée", async () => {
    const { reader, images } = fakeReader();
    await search(bethpage(), { reader });
    expect(images).toHaveLength(1);
    expect(images[0].equals(SGT_SCORECARD_30)).toBe(true);
  });

  // Spec « Distance dans les tees ». Mutation : comparer les tees sans `matchTee` → `choose_tee`.
  it("propose le tee White pour les tees « White 7468yd »", async () => {
    const id = bethpage("White 7468yd");
    await search(id);
    expect([ratingRow(id).status, ratingRow(id).proposedTee]).toEqual(["proposed", "White"]);
  });

  // Mutation : ne pas enregistrer l'usage, ou l'enregistrer à 0 µ$.
  it("enregistre l'usage de la lecture dans ai_usage", async () => {
    await search(bethpage());
    expect(aiUsageRows()).toEqual([
      {
        month: "2026-10",
        model: "claude-opus-5-5",
        inputTokens: 1352,
        outputTokens: 128,
        costMicroUsd: 7968,
      },
    ]);
  });

  // Spec : un seul nom en sous-chaîne n'est pas retenu d'office. Mutation : retenir un
  // candidat unique comme une correspondance.
  it("demande le choix du parcours pour « DIAMOND HAWK » (par 72), sans lecture", async () => {
    insertRound("DIAMOND HAWK", "White", PAR_72);
    const id = insertRating("DIAMOND HAWK", "White");
    const sgt = fakeSgt();
    const { reader, images } = fakeReader();
    await search(id, { sgt, reader });
    expect(ratingRow(id)).toMatchObject({
      status: "choose_course",
      sgtCourseId: null,
      candidates: [
        {
          id: 3222,
          name: "Diamond Hawk Golf Course & Pub",
          location: "Cheektowaga, New York, USA",
          par: 72,
        },
      ],
      teesRead: null,
    });
    expect([sgt.urls, images.length]).toEqual([[COURSES_URL], 0]);
  });

  // Mutation : chercher au par 71 en dur au lieu du par du round → Bethpage retenu.
  it("ne retient aucun parcours pour « BETHPAGE BLACK » au par 72 : not_found", async () => {
    insertRound("BETHPAGE BLACK", "Red", PAR_72);
    const id = insertRating("BETHPAGE BLACK", "Red");
    const { reader, images } = fakeReader();
    await search(id, { reader });
    expect([ratingRow(id).status, ratingRow(id).sgtCourseId, images.length]).toEqual([
      "not_found",
      null,
      0,
    ]);
  });

  // Spec « Tee absent de la carte ». Mutation : proposer le premier tee lu.
  it("demande le choix du tee quand aucun tee lu ne s'appelle « Gold »", async () => {
    const id = bethpage("Gold");
    await search(id);
    expect(ratingRow(id)).toMatchObject({
      status: "choose_tee",
      sgtCourseId: 30,
      teesRead: BETHPAGE_TEES,
      proposedTee: null,
    });
  });

  // Spec « Sans IA ou budget atteint ». Mutation : télécharger la carte avant de vérifier l'IA.
  it("sans IA, passe en manual « Lecture IA désactivée » sans télécharger la carte", async () => {
    const id = bethpage();
    const sgt = fakeSgt();
    await search(id, { sgt, reader: null });
    expect(ratingRow(id)).toMatchObject({
      status: "manual",
      note: "Lecture IA désactivée",
      sgtCourseId: 30,
    });
    expect(sgt.urls).toEqual([COURSES_URL]);
  });

  // Mutation : ne pas vérifier le budget, ou le vérifier pour 0 µ$.
  it("avec 0,037999 $ restants, passe en manual « Budget IA du mois atteint » sans appel", async () => {
    const id = bethpage();
    const sgt = fakeSgt();
    const { reader, images } = fakeReader();
    await search(id, { sgt, reader, spentMicroUsd: 962_001 });
    expect(ratingRow(id)).toMatchObject({
      status: "manual",
      note: "Budget IA du mois atteint",
      sgtCourseId: 30,
    });
    expect([sgt.urls, images.length]).toEqual([[COURSES_URL], 0]);
  });

  // Mutation : réserver MAX_CALL_COST (0,094 $) ou MAX_LOCATE_COST (0,056 $) au lieu de
  // MAX_RATING_COST (0,038 $).
  it("avec exactement 0,038 $ restants, lit la carte", async () => {
    const id = bethpage();
    const { reader, images } = fakeReader();
    await search(id, { reader, spentMicroUsd: 962_000 });
    expect([ratingRow(id).status, images.length]).toEqual(["proposed", 1]);
  });

  // Design, décision 3, étape 4. Mutations : laisser l'erreur remonter (job remis en file),
  // ne pas enregistrer l'usage d'un appel refusé.
  it("sur un refus de l'IA, passe en manual « Lecture IA impossible » et garde l'usage", async () => {
    const id = bethpage();
    const { reader } = fakeReader(new AiCompletionError("refusal", USAGE));
    await search(id, { reader });
    expect(ratingRow(id)).toMatchObject({
      status: "manual",
      note: "Lecture IA impossible",
      teesRead: null,
    });
    expect(aiUsageRows()).toEqual([
      {
        month: "2026-10",
        model: "claude-opus-5-5",
        inputTokens: 1352,
        outputTokens: 128,
        costMicroUsd: 7968,
      },
    ]);
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });

  // Mutation : traiter `card: null` comme une carte sans tee → `choose_tee`.
  it("sur une image qui n'est pas une carte SGT, passe en manual « Lecture IA impossible »", async () => {
    const id = bethpage();
    await search(id, { reader: fakeReader(null).reader });
    expect([ratingRow(id).status, ratingRow(id).note]).toEqual(["manual", "Lecture IA impossible"]);
  });

  // Design, décision 5. Mutation : ne pas comparer le par lu à celui du round.
  it("sur une carte au par 72 pour un round au par 71, passe en manual « Par de la carte SGT différent »", async () => {
    const id = bethpage();
    await search(id, { reader: fakeReader({ par: 72, tees: BETHPAGE_TEES }).reader });
    expect(ratingRow(id)).toMatchObject({
      status: "manual",
      note: "Par de la carte SGT différent",
      proposedTee: null,
    });
  });

  // Spec « SGT injoignable ». Mutations : attraper l'erreur réseau dans le job (aucune
  // nouvelle tentative), pas de `onFailed`, autre note.
  it.each([
    ["la liste", "down"],
    ["la carte", "scorecard-503"],
  ] as const)(
    "passe en failed « SGT injoignable » après deux échecs réseau sur %s",
    async (_what, mode) => {
      const id = bethpage();
      await search(id, { sgt: fakeSgt(mode), attempts: 2 });
      expect([ratingRow(id).status, ratingRow(id).note]).toEqual(["failed", "SGT injoignable"]);
      expect(jobRow(testDb().sqlite)).toMatchObject({ status: "failed", attempts: 2 });
    },
  );

  // Mutation : ignorer SGT_LOOKUP → la liste est téléchargée.
  it("avec SGT_LOOKUP=off, passe en manual « Recherche SGT désactivée » sans requête", async () => {
    const id = bethpage();
    const sgt = fakeSgt();
    const { reader, images } = fakeReader();
    await search(id, { sgt, reader, lookup: false });
    expect([ratingRow(id).status, ratingRow(id).note]).toEqual([
      "manual",
      "Recherche SGT désactivée",
    ]);
    expect([sgt.urls, images.length]).toEqual([[], 0]);
  });

  // Spec « Recherche relancée sur un parcours confirmé ». Mutation : écrire la proposition
  // (714 / 144, sgt) dans `rating_t` / `slope` / `source`, ou les remettre à null.
  it("garde rating_t, slope et source d'une ligne confirmée dont la recherche est relancée", async () => {
    const id = bethpage("Red", { ratingT: 700, slope: 130, source: "manual" });
    await search(id);
    expect(ratingRow(id)).toMatchObject({
      status: "proposed",
      ratingT: 700,
      slope: 130,
      source: "manual",
    });
  });

  // Design, décision 3 : un candidat choisi saute la correspondance. Mutations : rechercher
  // de nouveau dans la liste SGT, ou effacer le nom et le lieu SGT écrits par le choix.
  it("lit directement la carte du parcours SGT déjà retenu, sans télécharger la liste", async () => {
    const id = bethpage("Red", {
      sgtCourseId: 30,
      sgtCourseName: "Bethpage Black",
      sgtCourseLocation: "Farmingdale, NY",
    });
    const sgt = fakeSgt();
    await search(id, { sgt });
    expect(ratingRow(id)).toMatchObject({
      status: "proposed",
      proposedTee: "Red",
      sgtCourseId: 30,
      sgtCourseName: "Bethpage Black",
      sgtCourseLocation: "Farmingdale, NY",
    });
    expect(sgt.urls).toEqual([SCORECARD_30_URL]);
  });

  // Une ligne sans round (round supprimé ou renommé depuis) n'est pas une panne de SGT.
  // Mutation : lever une erreur (le runner réessaie, puis « SGT injoignable »).
  it("sans round sur la paire, passe en manual « Aucun round sur ce parcours » sans requête", async () => {
    const id = insertRating("BETHPAGE BLACK", "Red");
    const sgt = fakeSgt();
    await search(id, { sgt });
    expect([ratingRow(id).status, ratingRow(id).note, sgt.urls]).toEqual([
      "manual",
      "Aucun round sur ce parcours",
      [],
    ]);
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });

  // Les gestionnaires créés sans options (tests, scripts) ne doivent jamais appeler SGT.
  // Mutation : `lookup: true` par défaut dans `createJobHandlers` → la liste SGT est demandée.
  it("avec les gestionnaires par défaut, passe en manual « Recherche SGT désactivée » sans requête", async () => {
    const id = bethpage();
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(SGT_COURSES_HTML);
    });
    try {
      const { db } = testDb();
      const handlers = createJobHandlers(db, testDb().dir, { now: () => NOW });
      enqueueJob(db, COURSE_RATING_JOB, { courseRatingId: id }, NOW);
      await runNextJob(db, handlers, NOW);
    } finally {
      vi.unstubAllGlobals();
    }
    expect([ratingRow(id).status, ratingRow(id).note, urls]).toEqual([
      "manual",
      "Recherche SGT désactivée",
      [],
    ]);
  });
});
