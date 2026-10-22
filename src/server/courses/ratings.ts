import { and, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { courseRatings } from "@/db/schema";
import type { CourseRating } from "@/domain/handicap";
import type { Tx } from "@/server/rounds/stats";

export type RoundRating = CourseRating & { rated: boolean };

const sameText = (
  column: typeof courseRatings.courseName | typeof courseRatings.tees,
  value: string,
) => sql`lower(trim(${column})) = lower(trim(${value}))`;

/**
 * Rating et slope confirmés de la paire (nom, tees), sans tenir compte de la casse ni des
 * espaces (design, décision 2). Seuls `rating_t` et `slope` comptent, quel que soit le statut :
 * une recherche relancée garde la rating confirmée. Sans valeur confirmée, repli sur
 * par × 10 et slope 113 (décision 1), qui redonne le calcul sans rating.
 */
export function ratingFor(db: Db | Tx, courseName: string, tees: string, par: number): RoundRating {
  const row = db
    .select({ ratingT: courseRatings.ratingT, slope: courseRatings.slope })
    .from(courseRatings)
    .where(and(sameText(courseRatings.courseName, courseName), sameText(courseRatings.tees, tees)))
    .get();
  if (row?.ratingT == null || row.slope == null)
    return { ratingT: par * 10, slope: 113, rated: false };
  return { ratingT: row.ratingT, slope: row.slope, rated: true };
}
