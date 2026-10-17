import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerRoundStats, players, roundPlayers } from "@/db/schema";
import { playingHandicap } from "@/domain/strokes";

export type NetEntry = { gross: number; indexBeforeT: number | null };
export type Ranked<T> = T & {
  playingHandicap: number | null;
  net: number | null;
  rank: number | null;
};

/**
 * Classement net d'un round (spec `rounds`) : handicap de jeu = index juste avant le round
 * arrondi à l'entier, net = brut − handicap de jeu. Des nets égaux partagent le même rang
 * (rang de compétition : 1, 2, 2, 4). Sans index, ni net ni rang.
 */
export function rankNet<T extends NetEntry>(entries: readonly T[]): Ranked<T>[] {
  const withNet = entries.map((entry) => {
    const handicap = entry.indexBeforeT === null ? null : playingHandicap(entry.indexBeforeT);
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
  return rankNet(rows);
}
