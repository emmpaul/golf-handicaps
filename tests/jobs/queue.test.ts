import { describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { claimNextJob, enqueueJob } from "@/jobs/queue";
import { freshTestDb, markRunning as markJobRunning, minutesBefore, NOW } from "./helpers";

const testDb = freshTestDb();

const markRunning = (id: number, lockedAt: number) => markJobRunning(testDb().sqlite, id, lockedAt);

describe("claimNextJob", () => {
  it("réserve le job en file : passe en running, verrouillé maintenant, 1 tentative", () => {
    const id = enqueueJob(testDb().db, "ocr-scorecard", { importId: 7 }, NOW);
    const job = claimNextJob(testDb().db, NOW);
    expect(job).toMatchObject({
      id,
      type: "ocr-scorecard",
      payload: { importId: 7 },
      status: "running",
      attempts: 1,
      lockedAt: NOW,
    });
  });

  it("ne réserve qu'une fois un job unique demandé par deux connexions", () => {
    enqueueJob(testDb().db, "ocr-scorecard", { importId: 1 }, NOW);
    const other = openDatabase(testDb().file);
    try {
      const claims = [claimNextJob(testDb().db, NOW), claimNextJob(other.db, NOW)];
      expect(claims.map((job) => job?.payload ?? null)).toEqual([{ importId: 1 }, null]);
    } finally {
      other.sqlite.close();
    }
  });

  it("ne réserve pas un job dont run_after est dans le futur", () => {
    enqueueJob(testDb().db, "ocr-scorecard", { importId: 1 }, new Date(NOW.getTime() + 1));
    expect(claimNextJob(testDb().db, NOW)).toBeUndefined();
  });

  it("réserve les jobs dans l'ordre d'arrivée", () => {
    const first = enqueueJob(testDb().db, "ocr-scorecard", { importId: 1 }, NOW);
    enqueueJob(testDb().db, "ocr-scorecard", { importId: 2 }, NOW);
    expect(claimNextJob(testDb().db, NOW)?.id).toBe(first);
  });

  it("remet en file un job en running depuis plus de 5 minutes et le réserve", () => {
    const id = enqueueJob(testDb().db, "ocr-scorecard", { importId: 1 }, NOW);
    markRunning(id, minutesBefore(5, 1));
    expect(claimNextJob(testDb().db, NOW)).toMatchObject({ id, attempts: 2, lockedAt: NOW });
  });

  it("laisse tranquille un job en running depuis 5 minutes pile", () => {
    const id = enqueueJob(testDb().db, "ocr-scorecard", { importId: 1 }, NOW);
    markRunning(id, minutesBefore(5));
    expect(claimNextJob(testDb().db, NOW)).toBeUndefined();
  });
});
