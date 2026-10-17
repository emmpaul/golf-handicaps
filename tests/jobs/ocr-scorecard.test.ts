import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AiBudget } from "@/ai/budget";
import type { AiCard } from "@/ai/card";
import { AiCompletionError, type AiUsage, type DraftCompleter } from "@/ai/completer";
import { createImport, getImportStatus } from "@/jobs/imports";
import { createJobHandlers } from "@/jobs/ocr-scorecard";
import { enqueueJob } from "@/jobs/queue";
import { runNextJob } from "@/jobs/runner";
import type { Corners } from "@/ocr/corners";
import type { GrayImage } from "@/ocr/image";
import { readScorecard, type ScorecardReading } from "@/ocr/read-scorecard";
import type { ScorecardDraft } from "@/scorecard/draft";
import { referencePhoto } from "../ocr/reference";
import { freshTestDb, jobRow, markRunning, minutesBefore, NOW } from "./helpers";

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

const importReference = () => createImport(testDb().db, testDb().dir, referencePhoto(), NOW);

describe("gestionnaire ocr-scorecard", () => {
  it("passe l'import à « Prêt à vérifier » avec le brouillon de la photo de référence", async () => {
    const { id } = importReference();
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir), NOW);
    expect(getImportStatus(testDb().db, id)).toEqual({
      id,
      status: "ready",
      label: "Prêt à vérifier",
      draft: EXPECTED_DRAFT,
    });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  }, 60_000);

  it("met l'import en « Lecture en cours » pendant la lecture", async () => {
    const { id } = importReference();
    const seen: unknown[] = [];
    const read = async () => {
      seen.push(getImportStatus(testDb().db, id)?.label);
      return REFERENCE_READING;
    };
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, { read }), NOW);
    expect(seen).toEqual(["Lecture en cours"]);
  });

  it("lit la photo et les coins de l'import", async () => {
    const { id } = importReference();
    const calls: unknown[] = [];
    const read = async (photo: Buffer, corners: unknown) => {
      calls.push([photo.equals(referencePhoto().photo), corners]);
      return REFERENCE_READING;
    };
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, { read }), NOW);
    expect(calls).toEqual([[true, referencePhoto().corners]]);
    expect(getImportStatus(testDb().db, id)?.status).toBe("ready");
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

  it("laisse le job en failed et l'import en « Échec » après 2 échecs, avec last_error", async () => {
    const { id, photoPath } = importReference();
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
    const { id } = importReference();
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
  budget = new AiBudget(testDb().db, 1),
) {
  const { id } = importReference();
  const handlers = createJobHandlers(testDb().db, testDb().dir, {
    read,
    ai: { completer, budget },
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
  }, 60_000);

  it("complète Gab trou 9 par l'IA en un appel avec le panneau redressé", async () => {
    const fake = answersReferenceCard();
    const id = await runWithAi(readWithoutGab9, fake.completer);
    expect(fake.panels).toEqual([{ width: 2400, height: 1224 }]);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBe(5);
    expect(status?.draft).toEqual(EXPECTED_DRAFT);
    expect(aiState(id)).toEqual({ aiCells: '["player0:9"]', aiNote: null });
  }, 60_000);

  it("enregistre l'usage d'un appel réussi", async () => {
    await runWithAi(readWithoutGab9, answersReferenceCard().completer);
    expect(usageRows()).toEqual([USAGE_ROW]);
  }, 60_000);

  it("n'appelle pas l'IA quand le budget du mois est atteint", async () => {
    const budget = new AiBudget(testDb().db, 1);
    budget.record({ ...USAGE, costMicroUsd: 950_000 }, NOW);
    const fake = answersReferenceCard();
    const id = await runWithAi(readWithoutGab9, fake.completer, budget);
    expect(fake.panels).toEqual([]);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBeNull();
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: "Budget IA du mois atteint" });
  }, 60_000);

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
  }, 60_000);

  it("enregistre l'usage d'un refus et note « Complétion IA indisponible »", async () => {
    const fake = fakeCompleter(async () => {
      throw new AiCompletionError("refusal", USAGE);
    });
    const id = await runWithAi(readWithoutGab9, fake.completer);
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: "Complétion IA indisponible" });
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
    expect(usageRows()).toEqual([USAGE_ROW]);
  }, 60_000);

  it("sans clé, laisse le brouillon local sans aucune note", async () => {
    const { id } = importReference();
    const handlers = createJobHandlers(testDb().db, testDb().dir, { read: readWithoutGab9 });
    await runNextJob(testDb().db, handlers, NOW);
    const status = getImportStatus(testDb().db, id);
    expect(status?.label).toBe("Prêt à vérifier");
    expect(status?.draft?.players[0].scores.holes[8]).toBeNull();
    expect(aiState(id)).toEqual({ aiCells: null, aiNote: null });
    expect(usageRows()).toEqual([]);
  }, 60_000);
});
