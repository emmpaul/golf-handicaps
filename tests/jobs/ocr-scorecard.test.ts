import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AiBudget } from "@/ai/budget";
import type { AiCard } from "@/ai/card";
import { AiCompletionError, type AiUsage } from "@/ai/claude-call";
import type { DraftCompleter } from "@/ai/completer";
import type { CornerLocator } from "@/ai/corner-locator";
import { createImport, deleteImport, getImportStatus } from "@/jobs/imports";
import { locatePanel } from "@/jobs/locate-panel";
import { createJobHandlers } from "@/jobs/ocr-scorecard";
import { claimNextJob, enqueueJob } from "@/jobs/queue";
import { runNextJob } from "@/jobs/runner";
import type { Corners } from "@/ocr/corners";
import type { GrayImage } from "@/ocr/image";
import { readScorecard, type ScorecardReading } from "@/ocr/read-scorecard";
import type { ScorecardDraft } from "@/scorecard/draft";
import { referencePhoto } from "../ocr/reference";
import {
  cornersDeviation,
  freshTestDb,
  jobRow,
  markRunning,
  minutesBefore,
  NOW,
  referenceCorners,
  referenceWithTopBar,
} from "./helpers";

/** Brouillon écrit à la main d'après la photo IMG_3064 (tâche 6.7). */
const EXPECTED_DRAFT: ScorecardDraft = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/scorecards/gspro-img3064.draft.json"), "utf8"),
);

/** Lecture simulée : le brouillon de référence et un panneau factice. */
const REFERENCE_READING = {
  draft: EXPECTED_DRAFT,
  panel: { width: 1, height: 1, data: new Uint8Array(1) },
};

const testDb = freshTestDb();

const importPhoto = (photo: Buffer) => createImport(testDb().db, testDb().dir, { photo }, NOW);

const importReference = () => importPhoto(referencePhoto().photo);

/** Import de référence recadré à la main : ses coins font foi, sans détection. */
async function importReferenceWithCorners(corners: Corners = referenceCorners()) {
  const created = await importReference();
  testDb()
    .sqlite.prepare("UPDATE imports SET corners = ?, corners_source = 'manual' WHERE id = ?")
    .run(JSON.stringify(corners), created.id);
  return created;
}

/** Coins et provenance du cadrage enregistrés sur l'import. */
function framing(id: number): { corners: Corners | null; source: string | null } {
  const row = testDb()
    .sqlite.prepare("SELECT corners, corners_source AS source FROM imports WHERE id = ?")
    .get(id) as { corners: string | null; source: string | null };
  return { corners: row.corners && JSON.parse(row.corners), source: row.source };
}

/** Uniform grey 200 image of the reference size, as a JPEG: a white wall, no card. */
const greyWall = () =>
  sharp({ create: { width: 3000, height: 2250, channels: 3, background: "#c8c8c8" } })
    .jpeg()
    .toBuffer();

describe("gestionnaire ocr-scorecard", () => {
  it("passe l'import à « Prêt à vérifier » avec le brouillon de la photo de référence", async () => {
    const { id } = await importReference();
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir), NOW);
    expect(getImportStatus(testDb().db, id)).toEqual({
      id,
      status: "ready",
      label: "Prêt à vérifier",
      draft: EXPECTED_DRAFT,
    });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });

  // Mutation : ne pas enregistrer les coins trouvés, ou les enregistrer sans provenance.
  it("enregistre les coins détectés de la référence à 0,01 près, provenance auto", async () => {
    const { id } = await importReference();
    const readPanel = async () => EXPECTED_DRAFT;
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, { readPanel }), NOW);
    const { corners, source } = framing(id);
    expect(cornersDeviation(corners, referenceCorners())).toBeLessThan(0.01);
    expect([source, getImportStatus(testDb().db, id)?.status]).toEqual(["auto", "ready"]);
  });

  // Spec « Échec sans nouvelle tentative ». Mutation : lever quand aucun cadrage n'est trouvé →
  // job remis en file, import « Lecture en cours ».
  it("passe un import sans carte à « Échec » dès la 1re tentative, job done, sans coins", async () => {
    const { id } = await importPhoto(await greyWall());
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir), NOW);
    expect(getImportStatus(testDb().db, id)?.status).toBe("failed");
    expect(framing(id)).toEqual({ corners: null, source: null });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });

  it("met l'import en « Lecture en cours » pendant la lecture", async () => {
    const { id } = await importReferenceWithCorners();
    const seen: unknown[] = [];
    const read = async () => {
      seen.push(getImportStatus(testDb().db, id)?.label);
      return REFERENCE_READING;
    };
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, { read }), NOW);
    expect(seen).toEqual(["Lecture en cours"]);
  });

  // La lecture porte sur le WebP stocké, pas sur le JPEG envoyé (spec « Conservation de la photo »).
  it("lit la photo stockée en WebP et les coins de l'import", async () => {
    const { id, photoPath } = await importReferenceWithCorners();
    const stored = readFileSync(join(testDb().dir, photoPath));
    const calls: unknown[] = [];
    const read = async (photo: Buffer, corners: unknown) => {
      calls.push([photo.subarray(8, 12).toString("ascii"), photo.equals(stored), corners]);
      return REFERENCE_READING;
    };
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, { read }), NOW);
    expect(calls).toEqual([["WEBP", true, referencePhoto().corners]]);
    expect(getImportStatus(testDb().db, id)?.status).toBe("ready");
  });

  // Spec « Cadrage automatique à côté » : la main fait foi. Mutation : chercher le cadrage même
  // quand l'import a des coins → 1 appel à la détection.
  it("lit un import recadré à la main avec ses coins, sans aucune détection", async () => {
    const corners: Corners = {
      topLeft: { x: 0.02, y: 0.23 },
      topRight: { x: 0.99, y: 0.24 },
      bottomRight: { x: 0.96, y: 0.88 },
      bottomLeft: { x: 0.04, y: 0.87 },
    };
    const { id } = await importReferenceWithCorners(corners);
    const located: unknown[] = [];
    const locate: typeof locatePanel = async (...args) => {
      located.push(args);
      return locatePanel(...args);
    };
    const read: unknown[] = [];
    const handlers = createJobHandlers(testDb().db, testDb().dir, {
      locate,
      read: async (_photo, corners) => {
        read.push(corners);
        return REFERENCE_READING;
      },
    });
    await runNextJob(testDb().db, handlers, NOW);
    expect(located).toEqual([]);
    expect(read).toEqual([corners]);
    expect(framing(id)).toEqual({ corners, source: "manual" });
  });

  it("échoue en nommant l'import quand il n'existe plus", async () => {
    enqueueJob(testDb().db, "ocr-scorecard", { importId: 999 }, NOW);
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir), NOW);
    expect(jobRow(testDb().sqlite)).toEqual({
      status: "queued",
      attempts: 1,
      lastError: "Import introuvable : 999",
    });
  });

  // Design, décision 2 : job réservé, puis import supprimé avant de passer en lecture.
  // Mutations : retirer le contrôle de la ligne absente (TypeError sur `photoPath`) ; un
  // `onFailed` qui insère la ligne absente (upsert) recrée l'import.
  it("rejette « Import introuvable » sans recréer l'import supprimé après la réservation de son job", async () => {
    const { id } = await importReference();
    const job = claimNextJob(testDb().db, NOW);
    expect(deleteImport(testDb().db, id)).toMatchObject({ result: "deleted" });
    const handler = createJobHandlers(testDb().db, testDb().dir)["ocr-scorecard"];
    await expect(handler.run(job?.payload)).rejects.toThrow(`Import introuvable : ${id}`);
    handler.onFailed?.(job?.payload);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(0);
  });

  it("laisse le job en failed et l'import en « Échec » après 2 échecs, avec last_error", async () => {
    const { id, photoPath } = await importReference();
    rmSync(join(testDb().dir, photoPath));
    const handlers = createJobHandlers(testDb().db, testDb().dir);
    await runNextJob(testDb().db, handlers, NOW);
    expect(getImportStatus(testDb().db, id)?.label).toBe("Lecture en cours");
    await runNextJob(testDb().db, handlers, NOW);
    expect(jobRow(testDb().sqlite)).toEqual({
      status: "failed",
      attempts: 2,
      lastError: `ENOENT: no such file or directory, open '${join(testDb().dir, photoPath)}'`,
    });
    expect(getImportStatus(testDb().db, id)).toEqual({
      id,
      status: "failed",
      label: "Échec",
      draft: null,
    });
  });

  it("met l'import en « Échec » quand le worker meurt pendant la 2e tentative", async () => {
    const { id } = await importReference();
    const jobId = testDb().sqlite.prepare("SELECT id FROM jobs").pluck().get() as number;
    markRunning(testDb().sqlite, jobId, minutesBefore(6), 2);
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir), NOW);
    expect(getImportStatus(testDb().db, id)).toEqual({
      id,
      status: "failed",
      label: "Échec",
      draft: null,
    });
  });
});

/** Carte de l'IA : la carte de référence lue sans erreur (Gab trou 9 = 5), sans la date. */
const { playedOn: _, ...AI_CARD }: AiCard & { playedOn: unknown } = EXPECTED_DRAFT;

/** Usage d'un appel facturé : 1 700 tokens en entrée, 900 en sortie. */
const USAGE: AiUsage = { model: "claude-opus-5-5", inputTokens: 1700, outputTokens: 900 };

/** Ligne `ai_usage` de cet appel : 1 700 × 4 + 900 × 20 = 24 800 µ$, en 2026-10. */
const USAGE_ROW = {
  month: "2026-10",
  model: "claude-opus-5-5",
  inputTokens: 1700,
  outputTokens: 900,
  costMicroUsd: 24_800,
};

/** Vraie lecture locale de la photo, faite une fois pour le fichier ; copie neuve à chaque appel. */
let realReading: Promise<ScorecardReading> | undefined;
async function realRead(photo: Buffer, corners: Corners): Promise<ScorecardReading> {
  realReading ??= readScorecard(photo, corners);
  const { draft, panel } = await realReading;
  return { draft: structuredClone(draft), panel };
}

/** Vraie lecture locale dont le score de Gab au trou 9 est resté vide. */
async function readWithoutGab9(photo: Buffer, corners: Corners): Promise<ScorecardReading> {
  const reading = await realRead(photo, corners);
  reading.draft.players[0].scores.holes[8] = null;
  return reading;
}

/** Faux completer : note les panneaux reçus et répond par `answer`. */
function fakeCompleter(answer: () => Promise<{ card: AiCard; usage: AiUsage }>) {
  const panels: { width: number; height: number }[] = [];
  const completer: DraftCompleter = {
    complete(panel: GrayImage) {
      panels.push({ width: panel.width, height: panel.height });
      return answer();
    },
  };
  return { completer, panels };
}

const answersReferenceCard = () => fakeCompleter(async () => ({ card: AI_CARD, usage: USAGE }));

/** Faux cadrage IA : compte les appels et rend `corners`. */
function fakeLocator(corners: Corners | null) {
  const calls: number[] = [];
  const locator: CornerLocator = {
    async locate() {
      calls.push(1);
      return { corners, usage: USAGE };
    },
  };
  return { locator, calls };
}

/** Cadrage IA qui lève s'il est appelé : les imports de ces tests ont leurs coins. */
const unusedLocator: CornerLocator = {
  locate: () => Promise.reject(new Error("cadrage IA appelé pour un import qui a ses coins")),
};

/** Provenance IA et message enregistrés sur l'import. */
const aiState = (id: number) =>
  testDb()
    .sqlite.prepare("SELECT ai_cells AS aiCells, ai_note AS aiNote FROM imports WHERE id = ?")
    .get(id);

const usageRows = () =>
  testDb()
    .sqlite.prepare(
      "SELECT month, model, input_tokens AS inputTokens, output_tokens AS outputTokens, cost_micro_usd AS costMicroUsd FROM ai_usage",
    )
    .all();

/** Lance le job de l'import de référence avec la complétion IA, à NOW. */
async function runWithAi(
  read: typeof realRead,
  completer: DraftCompleter,
  budget = new AiBudget(testDb().db, 1, "America/Montreal"),
) {
  const { id } = await importReferenceWithCorners();
  const handlers = createJobHandlers(testDb().db, testDb().dir, {
    read,
    ai: { completer, locator: unusedLocator, budget },
    now: () => NOW,
  });
  await runNextJob(testDb().db, handlers, NOW);
  return id;
}

describe("gestionnaire ocr-scorecard, complétion IA", () => {
  it("n'appelle pas l'IA quand la lecture locale de référence est sans problème", async () => {
    const fake = answersReferenceCard();
    const id = await runWithAi(realRead, fake.completer);
    expect(fake.panels).toEqual([]);
    expect(getImportStatus(testDb().db, id)?.draft).toEqual(EXPECTED_DRAFT);
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: null });
  });

  it("complète Gab trou 9 par l'IA en un appel avec le panneau redressé", async () => {
    const fake = answersReferenceCard();
    const id = await runWithAi(readWithoutGab9, fake.completer);
    expect(fake.panels).toEqual([{ width: 2400, height: 1224 }]);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBe(5);
    expect(status?.draft).toEqual(EXPECTED_DRAFT);
    expect(aiState(id)).toEqual({ aiCells: '["player0:9"]', aiNote: null });
  });

  it("enregistre l'usage d'un appel réussi", async () => {
    await runWithAi(readWithoutGab9, answersReferenceCard().completer);
    expect(usageRows()).toEqual([USAGE_ROW]);
  });

  it("n'appelle pas l'IA quand le budget du mois est atteint", async () => {
    const budget = new AiBudget(testDb().db, 1, "America/Montreal");
    budget.record({ ...USAGE, costMicroUsd: 950_000 }, NOW);
    const fake = answersReferenceCard();
    const id = await runWithAi(readWithoutGab9, fake.completer, budget);
    expect(fake.panels).toEqual([]);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBeNull();
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: "Budget IA du mois atteint" });
  });

  it("garde le brouillon local quand l'API répond par une erreur, job done en 1 tentative", async () => {
    const fake = fakeCompleter(async () => {
      throw new Error("Connection error.");
    });
    const id = await runWithAi(readWithoutGab9, fake.completer);
    expect(fake.panels).toHaveLength(1);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBeNull();
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: "Complétion IA indisponible" });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
    expect(usageRows()).toEqual([]);
  });

  it("enregistre l'usage d'un refus et note « Complétion IA indisponible »", async () => {
    const fake = fakeCompleter(async () => {
      throw new AiCompletionError("refusal", USAGE);
    });
    const id = await runWithAi(readWithoutGab9, fake.completer);
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: "Complétion IA indisponible" });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
    expect(usageRows()).toEqual([USAGE_ROW]);
  });

  it("sans clé, laisse le brouillon local sans aucune note", async () => {
    const { id } = await importReferenceWithCorners();
    const handlers = createJobHandlers(testDb().db, testDb().dir, { read: readWithoutGab9 });
    await runNextJob(testDb().db, handlers, NOW);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBeNull();
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: null });
    expect(usageRows()).toEqual([]);
  });
});

describe("gestionnaire ocr-scorecard, cadrage par l'IA", () => {
  /** Lance le job d'un import sans coins de `photo`, avec le cadrage et la complétion IA. */
  async function runFraming(
    photo: Buffer,
    locator: CornerLocator,
    completer: DraftCompleter,
    readPanel = async () => EXPECTED_DRAFT,
  ) {
    const { id } = await importPhoto(photo);
    const handlers = createJobHandlers(testDb().db, testDb().dir, {
      readPanel,
      ai: { completer, locator, budget: new AiBudget(testDb().db, 1, "America/Montreal") },
      now: () => NOW,
    });
    await runNextJob(testDb().db, handlers, NOW);
    return id;
  }

  // La barre blanche fait échouer la détection sur toute la photo (helpers). Mutation : enregistrer
  // `auto` pour un cadrage venu de l'IA.
  it("enregistre la provenance ai quand la détection locale échoue et que l'IA trouve le panneau", async () => {
    const framer = fakeLocator(referenceCorners());
    const fake = answersReferenceCard();
    const id = await runFraming(await referenceWithTopBar(), framer.locator, fake.completer);
    const { corners, source } = framing(id);
    expect(framer.calls).toHaveLength(1);
    expect(source).toBe("ai");
    expect(cornersDeviation(corners, referenceCorners())).toBeLessThan(0.01);
    expect(getImportStatus(testDb().db, id)?.status).toBe("ready");
  });

  // Spec « Cadrage et complétion par l'IA ».
  it("fait exactement deux appels, cadrage puis complétion, quand Gab trou 9 reste vide", async () => {
    const framer = fakeLocator(referenceCorners());
    const fake = answersReferenceCard();
    const readPanel = async () => {
      const draft = structuredClone(EXPECTED_DRAFT);
      draft.players[0].scores.holes[8] = null;
      return draft;
    };
    const id = await runFraming(
      await referenceWithTopBar(),
      framer.locator,
      fake.completer,
      readPanel,
    );
    expect([framer.calls.length, fake.panels.length]).toEqual([1, 1]);
    expect(usageRows()).toEqual([USAGE_ROW, USAGE_ROW]);
    expect(getImportStatus(testDb().db, id)?.draft).toEqual(EXPECTED_DRAFT);
  });

  it("passe à « Échec » sans relance quand l'IA ne voit pas de carte non plus", async () => {
    const framer = fakeLocator(null);
    const fake = answersReferenceCard();
    const id = await runFraming(await greyWall(), framer.locator, fake.completer);
    expect([framer.calls.length, fake.panels.length]).toEqual([1, 0]);
    expect(getImportStatus(testDb().db, id)?.status).toBe("failed");
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });
});
