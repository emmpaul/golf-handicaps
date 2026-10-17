import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { jobs } from "@/db/schema";

export type Job = typeof jobs.$inferSelect;

/** Un job resté en `running` plus longtemps est considéré comme abandonné (worker tué). */
export const STALE_AFTER_MS = 5 * 60_000;

/** Après ce nombre de tentatives en échec, le job passe en `failed` (design, décision 4). */
export const MAX_ATTEMPTS = 2;

/** `last_error` d'un job abandonné par un worker tué pendant sa dernière tentative. */
export const WORKER_INTERRUPTED = "Worker interrompu";

export function enqueueJob(
  db: Pick<Db, "insert">,
  type: string,
  payload: unknown,
  now: Date,
): number {
  return db
    .insert(jobs)
    .values({ type, payload, runAfter: now, createdAt: now })
    .returning({ id: jobs.id })
    .get().id;
}

const isStale = (now: Date) =>
  and(eq(jobs.status, "running"), lt(jobs.lockedAt, new Date(now.getTime() - STALE_AFTER_MS)));

function requeueStaleJobs(db: Db, now: Date) {
  db.update(jobs)
    .set({ status: "queued", lockedAt: null })
    .where(and(isStale(now), lt(jobs.attempts, MAX_ATTEMPTS)))
    .run();
}

/**
 * Passe en `failed` les jobs abandonnés qui ont déjà épuisé leurs tentatives, et les renvoie
 * (un seul `UPDATE … RETURNING` : un job n'est renvoyé qu'à un seul worker).
 */
export function failExhaustedStaleJobs(db: Db, now: Date): Job[] {
  return db
    .update(jobs)
    .set({ status: "failed", lockedAt: null, lastError: WORKER_INTERRUPTED })
    .where(and(isStale(now), gte(jobs.attempts, MAX_ATTEMPTS)))
    .returning()
    .all();
}

/**
 * Réserve le plus ancien job prêt, en une seule requête `UPDATE … WHERE id = (SELECT …)
 * RETURNING *` : deux workers ne peuvent pas réserver le même job (design, décision 4).
 */
export function claimNextJob(db: Db, now: Date): Job | undefined {
  requeueStaleJobs(db, now);
  const next = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.status, "queued"), lte(jobs.runAfter, now)))
    .orderBy(asc(jobs.id))
    .limit(1);
  return db
    .update(jobs)
    .set({ status: "running", lockedAt: now, attempts: sql`${jobs.attempts} + 1` })
    .where(sql`${jobs.id} = (${next})`)
    .returning()
    .get();
}
