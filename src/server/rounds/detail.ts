import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { roundHoles, rounds } from "@/db/schema";
import { ratingFor } from "@/server/courses/ratings";
import { roundLeaderboard } from "./leaderboard";

/**
 * Détail d'un round : parcours, par total, photo, rating utilisée (confirmée ou repli par / 113)
 * et classement net (spec `rounds`).
 */
export function roundDetail(db: Db, roundId: number) {
  const round = db.select().from(rounds).where(eq(rounds.id, roundId)).get();
  if (!round) return undefined;
  const par = db
    .select({ par: roundHoles.par })
    .from(roundHoles)
    .where(eq(roundHoles.roundId, roundId))
    .all()
    .reduce((total, { par }) => total + par, 0);
  return {
    ...round,
    par,
    rating: ratingFor(db, round.courseName, round.tees, par),
    leaderboard: roundLeaderboard(db, roundId),
  };
}
