import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { jobs } from "@/db/schema";
import { claimNextJob, failExhaustedStaleJobs, type Job, MAX_ATTEMPTS } from "./queue";

export type JobHandler = {
  run(payload: unknown): Promise<void>;
  /** Appelé une seule fois, quand le job passe définitivement en `failed`. */
  onFailed?(payload: unknown): void;
};

export type JobHandlers = Record<string, JobHandler>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function recordFailure(
  db: Db,
  job: Job,
  handler: JobHandler | undefined,
  error: unknown,
  now: Date,
) {
  const lastError = errorMessage(error);
  if (job.attempts >= MAX_ATTEMPTS) {
    db.update(jobs)
      .set({ status: "failed", lockedAt: null, lastError })
      .where(eq(jobs.id, job.id))
      .run();
    handler?.onFailed?.(job.payload);
    return;
  }
  db.update(jobs)
    .set({ status: "queued", lockedAt: null, lastError, runAfter: now })
    .where(eq(jobs.id, job.id))
    .run();
}

/** Réserve un job et l'exécute. Renvoie `false` quand aucun job n'attend. */
export async function runNextJob(db: Db, handlers: JobHandlers, now: Date): Promise<boolean> {
  for (const abandoned of failExhaustedStaleJobs(db, now)) {
    handlers[abandoned.type]?.onFailed?.(abandoned.payload);
  }
  const job = claimNextJob(db, now);
  if (!job) return false;
  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`Type de job inconnu : ${job.type}`);
    await handler.run(job.payload);
    db.update(jobs).set({ status: "done", lockedAt: null }).where(eq(jobs.id, job.id)).run();
  } catch (error) {
    recordFailure(db, job, handler, error, now);
  }
  return true;
}
