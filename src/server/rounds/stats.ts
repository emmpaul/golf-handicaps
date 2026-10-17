import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerRoundStats, roundHoles, roundPlayers, rounds, scores } from "@/db/schema";
import {
  adjustedScore,
  computeIndex,
  differentialTenths,
  type RoundDifferential,
} from "@/domain/handicap";

/** Transaction Drizzle ouverte par `db.transaction`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

/** Rounds du joueur dans l'ordre du calcul d'index : date de jeu, enregistrement, puis id. */
function playerHistory(tx: Tx, playerId: number) {
  return tx
    .select({ roundId: rounds.id, playedOn: rounds.playedOn, createdAt: rounds.createdAt })
    .from(roundPlayers)
    .innerJoin(rounds, eq(rounds.id, roundPlayers.roundId))
    .where(eq(roundPlayers.playerId, playerId))
    .orderBy(asc(rounds.playedOn), asc(rounds.createdAt), asc(rounds.id))
    .all();
}

function roundCard(tx: Tx, roundId: number, playerId: number) {
  const pars = tx
    .select({ par: roundHoles.par })
    .from(roundHoles)
    .where(eq(roundHoles.roundId, roundId))
    .orderBy(asc(roundHoles.hole))
    .all()
    .map((row) => row.par);
  const strokes = tx
    .select({ strokes: scores.strokes })
    .from(scores)
    .where(and(eq(scores.roundId, roundId), eq(scores.playerId, playerId)))
    .orderBy(asc(scores.hole))
    .all()
    .map((row) => row.strokes);
  return { pars, strokes };
}

/**
 * Rejoue tout l'historique d'un joueur et réécrit ses lignes de `player_round_stats`
 * (design, décision 3) : différentiel, index juste avant et juste après chaque round,
 * et différentiels retenus dans l'index actuel.
 */
export function recomputePlayerStats(tx: Tx, playerId: number) {
  tx.delete(playerRoundStats).where(eq(playerRoundStats.playerId, playerId)).run();
  const played: RoundDifferential[] = [];
  const rows = playerHistory(tx, playerId).map(({ roundId, playedOn, createdAt }) => {
    const { pars, strokes } = roundCard(tx, roundId, playerId);
    const differentialT = differentialTenths(strokes, pars);
    const indexBeforeT = computeIndex(played).indexT;
    played.push({ playedOn, createdAt: createdAt.toISOString(), differentialT });
    return {
      roundId,
      playerId,
      gross: total(strokes),
      adjusted: adjustedScore(strokes, pars),
      differentialT,
      indexBeforeT,
      // Au moins un round joué : l'index existe toujours.
      indexAfterT: computeIndex(played).indexT as number,
    };
  });
  const { counts } = computeIndex(played);
  rows.forEach((row, i) => {
    tx.insert(playerRoundStats)
      .values({ ...row, countsInCurrent: counts[i] })
      .run();
  });
}

export function recomputeStats(tx: Tx, playerIds: Iterable<number>) {
  for (const playerId of new Set(playerIds)) recomputePlayerStats(tx, playerId);
}
