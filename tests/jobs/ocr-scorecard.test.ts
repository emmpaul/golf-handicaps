import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createImport, getImportStatus } from "@/jobs/imports";
import { createJobHandlers } from "@/jobs/ocr-scorecard";
import { enqueueJob } from "@/jobs/queue";
import { runNextJob } from "@/jobs/runner";
import type { ScorecardDraft } from "@/scorecard/draft";
import { referencePhoto } from "../ocr/reference";
import { freshTestDb, jobRow, markRunning, minutesBefore, NOW } from "./helpers";

/** Brouillon écrit à la main d'après la photo IMG_3064 (tâche 6.7). */
const EXPECTED_DRAFT: ScorecardDraft = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/scorecards/gspro-img3064.draft.json"), "utf8"),
);

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
      return EXPECTED_DRAFT;
    };
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, read), NOW);
    expect(seen).toEqual(["Lecture en cours"]);
  });

  it("lit la photo et les coins de l'import", async () => {
    const { id } = importReference();
    const calls: unknown[] = [];
    const read = async (photo: Buffer, corners: unknown) => {
      calls.push([photo.equals(referencePhoto().photo), corners]);
      return EXPECTED_DRAFT;
    };
    await runNextJob(testDb().db, createJobHandlers(testDb().db, testDb().dir, read), NOW);
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
