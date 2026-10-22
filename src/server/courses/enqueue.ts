import { asc } from "drizzle-orm";
import type { Db } from "@/db/client";
import { courseRatings, rounds } from "@/db/schema";
import { COURSE_RATING_JOB, type CourseRatingPayload } from "@/jobs/course-rating";
import { enqueueJob } from "@/jobs/queue";
import type { Tx } from "@/server/rounds/stats";

/**
 * Insère la ligne `pending` de la paire (nom, tees) et met son job `course-rating` en file,
 * sauf si la paire a déjà une ligne, sans tenir compte de la casse ni des espaces (index
 * unique `course_ratings_course_tees_unique`). Rend `true` quand un job est mis en file.
 */
export function enqueueCourseRating(
  tx: Db | Tx,
  courseName: string,
  tees: string,
  now = new Date(),
): boolean {
  const inserted = tx
    .insert(courseRatings)
    .values({ courseName, tees, status: "pending", updatedAt: now })
    .onConflictDoNothing()
    .returning({ id: courseRatings.id })
    .get();
  if (!inserted) return false;
  const payload: CourseRatingPayload = { courseRatingId: inserted.id };
  enqueueJob(tx, COURSE_RATING_JOB, payload, now);
  return true;
}

/**
 * Balayage du démarrage (design, décision 3) : une ligne `pending` et un job par paire
 * (nom, tees) des rounds enregistrés qui n'a pas encore de ligne. Les rounds sont parcourus
 * du plus ancien au plus récent, pour que la ligne garde le texte du premier round
 * (décision 2). Rend le nombre de jobs mis en file : 0 une fois toutes les paires couvertes.
 */
export function enqueueMissingCourseRatings(db: Db, now = new Date()): number {
  return db.transaction((tx) => {
    const pairs = tx
      .select({ courseName: rounds.courseName, tees: rounds.tees })
      .from(rounds)
      .orderBy(asc(rounds.playedOn), asc(rounds.createdAt), asc(rounds.id))
      .all();
    return pairs.filter(({ courseName, tees }) => enqueueCourseRating(tx, courseName, tees, now))
      .length;
  });
}
