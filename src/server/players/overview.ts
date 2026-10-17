import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerAliases, playerRoundStats, rounds } from "@/db/schema";
import { listPlayers } from "./players";

/** Moins de 3 rounds : l'index est provisoire (spec `handicap-index`). */
const PROVISIONAL_BELOW = 3;

export type PlayerOverview = ReturnType<typeof playerOverviews>[number];

/**
 * Chaque joueur avec ses alias, son historique (un point par round, dans l'ordre du calcul
 * d'index) et son index actuel : celui juste après son dernier round, `null` sans round.
 */
export function playerOverviews(db: Db) {
  const aliases = db
    .select({ playerId: playerAliases.playerId, alias: playerAliases.alias })
    .from(playerAliases)
    .orderBy(asc(playerAliases.alias))
    .all();
  const stats = db
    .select({
      playerId: playerRoundStats.playerId,
      roundId: rounds.id,
      playedOn: rounds.playedOn,
      differentialT: playerRoundStats.differentialT,
      indexAfterT: playerRoundStats.indexAfterT,
      countsInCurrent: playerRoundStats.countsInCurrent,
    })
    .from(playerRoundStats)
    .innerJoin(rounds, eq(rounds.id, playerRoundStats.roundId))
    .orderBy(asc(rounds.playedOn), asc(rounds.createdAt), asc(rounds.id))
    .all();
  return listPlayers(db).map(({ id, name }) => {
    const history = stats
      .filter((row) => row.playerId === id)
      .map(({ playerId: _, ...row }) => row);
    return {
      id,
      name,
      aliases: aliases.filter((row) => row.playerId === id).map((row) => row.alias),
      history,
      indexT: history.at(-1)?.indexAfterT ?? null,
      provisional: history.length > 0 && history.length < PROVISIONAL_BELOW,
    };
  });
}
