import { describe, expect, it } from "vitest";
import { readEditorState, toSavedCorrection } from "@/components/round-editor/form-state";
import { imports } from "@/db/schema";
import type { ScorecardDraft } from "@/scorecard/draft";
import { getImport, initialEditorState, saveCorrection } from "@/server/imports/correction";
import { saveRound } from "@/server/rounds/save";
import { referenceForm, seededTestDbPerTest } from "../../factories";
import referenceDraft from "../../fixtures/scorecards/gspro-img3064.draft.json";

const testDb = seededTestDbPerTest();

type ImportValues = Pick<typeof imports.$inferInsert, "status" | "draft" | "correction">;

/** Import de la photo de référence dans l'état donné. Renvoie son id. */
function seedImport(values: ImportValues): number {
  return testDb.db
    .insert(imports)
    .values({ photoPath: "uploads/reference.jpg", corners: {}, ...values })
    .returning({ id: imports.id })
    .get().id;
}

/** Correction de la carte de référence : lignes GAB et MANU associées, date du 13 octobre. */
function correction() {
  const state = readEditorState(referenceForm([testDb.ids.Gab, testDb.ids.Manu]), true);
  state.form.playedOn = "2026-10-13";
  return toSavedCorrection(state);
}

const columns = (id: number) =>
  testDb.sqlite.prepare("SELECT draft, correction FROM imports WHERE id = ?").get(id) as {
    draft: string | null;
    correction: string | null;
  };

const storedCorrection = (id: number) => {
  const raw = columns(id).correction;
  return raw === null ? null : JSON.parse(raw);
};

describe("saveCorrection", () => {
  // Mutation : correction écrite dans `draft`, ou pas écrite du tout.
  it("enregistre la correction d'un import « Prêt à vérifier » sans toucher à sa lecture", () => {
    const draft: ScorecardDraft = structuredClone(referenceDraft);
    const id = seedImport({ status: "ready", draft });

    expect(saveCorrection(testDb.db, String(id), correction())).toBe("ok");

    expect(storedCorrection(id)).toEqual(correction());
    expect(storedCorrection(id).card.playedOn).toBe("2026-10-13");
    expect(JSON.parse(columns(id).draft ?? "null")).toEqual(referenceDraft);
  });

  // Mutation : seul le statut « ready » accepté dans la condition de l'UPDATE.
  it("enregistre la correction d'un import en « Échec » sans brouillon", () => {
    const id = seedImport({ status: "failed", draft: null });

    expect(saveCorrection(testDb.db, String(id), correction())).toBe("ok");
    expect(storedCorrection(id).card.playedOn).toBe("2026-10-13");
  });

  // Mutation : statut absent de la condition de l'UPDATE.
  it.each(["queued", "reading"] as const)(
    "refuse « Lecture en cours » pour un import au statut %s, sans rien écrire",
    (status) => {
      const id = seedImport({ status, draft: null });

      expect(saveCorrection(testDb.db, String(id), correction())).toBe("reading");
      expect(columns(id).correction).toBeNull();
    },
  );

  // Mutation : retirer `round_id IS NULL` de la condition de l'UPDATE.
  it("refuse « Cette carte est déjà enregistrée » pour un import lié à un round, sans rien écrire", () => {
    const earlier = { ...correction(), card: { ...correction().card, playedOn: "2026-10-12" } };
    const id = seedImport({ status: "ready", draft: referenceDraft, correction: earlier });
    saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]), { importId: id });

    expect(saveCorrection(testDb.db, String(id), correction())).toBe("already-saved");
    expect(storedCorrection(id).card.playedOn).toBe("2026-10-12");
  });

  // Mutation : identifiant non vérifié (Number("abc") passé à la requête), ou import inconnu pris pour « Lecture en cours ».
  it.each(["999", "abc"])("répond « Import introuvable » pour l'import %s", (id) => {
    expect(saveCorrection(testDb.db, id, correction())).toBe("not-found");
  });

  // Mutation : corps non validé par `savedCorrectionSchema`.
  it("refuse « Requête invalide » un corps où `players` remplace `lines`", () => {
    const id = seedImport({ status: "ready", draft: referenceDraft });
    const { lines, ...rest } = correction();

    expect(saveCorrection(testDb.db, String(id), { ...rest, players: lines })).toBe("invalid");
    expect(columns(id).correction).toBeNull();
  });
});

describe("initialEditorState", () => {
  const stateOf = (id: number) => {
    const row = getImport(testDb.db, id);
    if (!row) throw new Error(`import ${id} absent`);
    return initialEditorState(testDb.db, row, "2026-10-20");
  };

  // Mutation : lire `draft` avant `correction`.
  it("reprend une correction valide : la date du 13 octobre, pas celle lue sur la carte", () => {
    const id = seedImport({ status: "ready", draft: referenceDraft, correction: correction() });

    const state = stateOf(id);

    expect(state.form.playedOn).toBe("2026-10-13");
    expect(state.lines.map(({ playerId }) => playerId)).toEqual([testDb.ids.Gab, testDb.ids.Manu]);
  });

  // Mutation : correction reprise sans passer par `savedCorrectionSchema`.
  it("ignore une correction en `version: 2` et repart du brouillon, ligne 1 associée à Gab par l'alias « GAB »", () => {
    const id = seedImport({
      status: "ready",
      draft: referenceDraft,
      correction: { ...correction(), version: 2 },
    });

    const state = stateOf(id);

    expect(state.form.playedOn).toBe("2026-10-17");
    expect(state.lines[0].name).toBe("GAB");
    expect(state.lines[0].playerId).toBe(testDb.ids.Gab);
  });

  // Mutation : date du jour ignorée pour l'écran vide.
  it("donne l'écran vide daté du jour pour un import en « Échec » sans brouillon ni correction", () => {
    const id = seedImport({ status: "failed", draft: null });
    const row = getImport(testDb.db, id);
    if (!row) throw new Error(`import ${id} absent`);

    const state = initialEditorState(testDb.db, row, "2026-10-17");

    expect(state.form).toEqual({
      courseName: null,
      tees: null,
      playedOn: "2026-10-17",
      par: { holes: Array(18).fill(null), out: 0, in: 0, total: 0 },
      strokeIndex: Array(18).fill(null),
      distance: { holes: Array(18).fill(null), out: 0, in: 0, total: 0 },
    });
    expect(state.lines.map(({ name, playerId }) => ({ name, playerId }))).toEqual([
      { name: null, playerId: null },
    ]);
    expect(state.aiCells).toEqual([]);
  });
});
