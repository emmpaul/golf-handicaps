import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerRoundStats, players, roundHoles, roundPlayers, rounds } from "@/db/schema";
import { courseHandicap, type RatedCourse } from "@/domain/strokes";
import { ratingFor } from "@/server/courses/ratings";

export type NetEntry = { gross: number; indexBeforeT: number | null };
export type Ranked<T> = T & {
  playingHandicap: number | null;
  net: number | null;
  rank: number | null;
};

/**
 * Classement net d'un round (spec `rounds`) : handicap de jeu = handicap de parcours depuis
 * l'index juste avant le round (index arrondi sans `course`), net = brut − handicap de jeu.
 * Des nets égaux partagent le même rang (rang de compétition : 1, 2, 2, 4). Sans index,
 * ni net ni rang.
 */
export function rankNet<T extends NetEntry>(
  entries: readonly T[],
  course?: RatedCourse,
): Ranked<T>[] {
  const withNet = entries.map((entry) => {
    const handicap =
      entry.indexBeforeT === null ? null : courseHandicap(entry.indexBeforeT, course);
    return {
      ...entry,
      playingHandicap: handicap,
      net: handicap === null ? null : entry.gross - handicap,
    };
  });
  const nets = withNet.flatMap(({ net }) => (net === null ? [] : [net]));
  return withNet.map((entry) => ({
    ...entry,
    rank: entry.net === null ? null : 1 + nets.filter((net) => net < (entry.net ?? 0)).length,
  }));
}

/** Rating du round (confirmée ou repli par / 113) avec son par total. */
function roundCourse(db: Db, roundId: number): RatedCourse {
  const round = db
    .select({ courseName: rounds.courseName, tees: rounds.tees })
    .from(rounds)
    .where(eq(rounds.id, roundId))
    .get();
  const par = db
    .select({ par: roundHoles.par })
    .from(roundHoles)
    .where(eq(roundHoles.roundId, roundId))
    .all()
    .reduce((sum, row) => sum + row.par, 0);
  // Le repli (par × 10, 113) redonne exactement l'index arrondi.
  const { ratingT, slope } = ratingFor(db, round?.courseName ?? "", round?.tees ?? "", par);
  return { ratingT, slope, par };
}

/** Lignes du classement net d'un round, dans l'ordre des lignes de la carte. */
export function roundLeaderboard(db: Db, roundId: number) {
  const rows = db
    .select({
      playerId: players.id,
      name: players.name,
      gross: playerRoundStats.gross,
      indexBeforeT: playerRoundStats.indexBeforeT,
    })
    .from(roundPlayers)
    .innerJoin(players, eq(players.id, roundPlayers.playerId))
    .innerJoin(
      playerRoundStats,
      and(
        eq(playerRoundStats.roundId, roundPlayers.roundId),
        eq(playerRoundStats.playerId, roundPlayers.playerId),
      ),
    )
    .where(eq(roundPlayers.roundId, roundId))
    .orderBy(asc(roundPlayers.position))
    .all();
  return rankNet(rows, roundCourse(db, roundId));
}
