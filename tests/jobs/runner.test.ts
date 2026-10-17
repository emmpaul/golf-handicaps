import { describe, expect, it } from "vitest";
import { enqueueJob } from "@/jobs/queue";
import { type JobHandlers, runNextJob } from "@/jobs/runner";
import { freshTestDb, jobRow, markRunning, minutesBefore, NOW } from "./helpers";

const testDb = freshTestDb();

function failingHandlers(failed: unknown[]): JobHandlers {
  return {
    flaky: {
      run: () => Promise.reject(new Error("lecture impossible")),
      onFailed: (payload) => {
        failed.push(payload);
      },
    },
  };
}

describe("runNextJob", () => {
  it("passe le job en done quand le gestionnaire réussit, avec son payload", async () => {
    const seen: unknown[] = [];
    enqueueJob(testDb().db, "ok", { importId: 3 }, NOW);
    const handlers: JobHandlers = {
      ok: {
        run: async (payload) => {
          seen.push(payload);
        },
      },
    };
    expect(await runNextJob(testDb().db, handlers, NOW)).toBe(true);
    expect(seen).toEqual([{ importId: 3 }]);
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 1, lastError: null });
  });

  it("renvoie false quand aucun job n'attend", async () => {
    expect(await runNextJob(testDb().db, {}, NOW)).toBe(false);
  });

  it("remet le job en file après un premier échec, avec last_error", async () => {
    const failed: unknown[] = [];
    enqueueJob(testDb().db, "flaky", { importId: 3 }, NOW);
    await runNextJob(testDb().db, failingHandlers(failed), NOW);
    expect(jobRow(testDb().sqlite)).toEqual({
      status: "queued",
      attempts: 1,
      lastError: "lecture impossible",
    });
    expect(failed).toEqual([]);
  });

  it("passe le job en failed après 2 tentatives et prévient le gestionnaire", async () => {
    const failed: unknown[] = [];
    enqueueJob(testDb().db, "flaky", { importId: 3 }, NOW);
    await runNextJob(testDb().db, failingHandlers(failed), NOW);
    await runNextJob(testDb().db, failingHandlers(failed), NOW);
    expect(jobRow(testDb().sqlite)).toEqual({
      status: "failed",
      attempts: 2,
      lastError: "lecture impossible",
    });
    expect(failed).toEqual([{ importId: 3 }]);
    expect(await runNextJob(testDb().db, failingHandlers(failed), NOW)).toBe(false);
  });

  it("fait échouer un job de type inconnu en nommant le type", async () => {
    enqueueJob(testDb().db, "mystere", {}, NOW);
    await runNextJob(testDb().db, {}, NOW);
    expect(jobRow(testDb().sqlite)).toEqual({
      status: "queued",
      attempts: 1,
      lastError: "Type de job inconnu : mystere",
    });
  });

  it("passe en failed, sans le relancer, un job abandonné après ses 2 tentatives", async () => {
    const failed: unknown[] = [];
    const ran: unknown[] = [];
    const id = enqueueJob(testDb().db, "flaky", { importId: 3 }, NOW);
    markRunning(testDb().sqlite, id, minutesBefore(5, 1), 2);
    const handlers: JobHandlers = {
      flaky: {
        run: async (payload) => {
          ran.push(payload);
        },
        onFailed: (payload) => {
          failed.push(payload);
        },
      },
    };
    await runNextJob(testDb().db, handlers, NOW);
    expect(ran).toEqual([]);
    expect(jobRow(testDb().sqlite)).toEqual({
      status: "failed",
      attempts: 2,
      lastError: "Worker interrompu",
    });
    expect(failed).toEqual([{ importId: 3 }]);
  });

  it("relance un job abandonné après 1 seule tentative", async () => {
    const ran: unknown[] = [];
    const id = enqueueJob(testDb().db, "ok", { importId: 4 }, NOW);
    markRunning(testDb().sqlite, id, minutesBefore(5, 1), 1);
    const handlers: JobHandlers = {
      ok: {
        run: async (payload) => {
          ran.push(payload);
        },
      },
    };
    expect(await runNextJob(testDb().db, handlers, NOW)).toBe(true);
    expect(ran).toEqual([{ importId: 4 }]);
    expect(jobRow(testDb().sqlite)).toEqual({ status: "done", attempts: 2, lastError: null });
  });
});
