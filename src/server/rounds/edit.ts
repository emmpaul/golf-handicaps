import { asc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players, roundHoles, roundPlayers, rounds, scores } from "@/db/schema";
import { type RoundForm, withTotals } from "@/scorecard/checks";
import { assertCoherent, formPlayerIds, roundColumns, writeRoundCard } from "./save";
import { recomputeStats, type Tx } from "./stats";

export class RoundNotFoundError extends Error {
  constructor() {
    super("Round introuvable");
    this.name = "RoundNotFoundError";
  }
}

function findRound(db: Db | Tx, roundId: number) {
  const round = db.select().from(rounds).where(eq(rounds.id, roundId)).get();
  if (!round) throw new RoundNotFoundError();
  return round;
}

function playerIdsOf(tx: Tx, roundId: number) {
  return tx
    .select({ playerId: roundPlayers.playerId })
    .from(roundPlayers)
    .where(eq(roundPlayers.roundId, roundId))
    .all()
    .map((row) => row.playerId);
}

/** Relit un round enregistré dans le formulaire de l'écran de correction (totaux recalculés). */
export function getRoundForm(db: Db, roundId: number): RoundForm {
  const round = findRound(db, roundId);
  const holes = db
    .select()
    .from(roundHoles)
    .where(eq(roundHoles.roundId, roundId))
    .orderBy(asc(roundHoles.hole))
    .all();
  const lines = db
    .select({ playerId: players.id, name: players.name })
    .from(roundPlayers)
    .innerJoin(players, eq(players.id, roundPlayers.playerId))
    .where(eq(roundPlayers.roundId, roundId))
    .orderBy(asc(roundPlayers.position))
    .all();
  const strokes = db
    .select()
    .from(scores)
    .where(eq(scores.roundId, roundId))
    .orderBy(asc(scores.hole))
    .all();
  return {
    courseName: round.courseName,
    tees: round.tees,
    playedOn: round.playedOn,
    par: withTotals(holes.map((hole) => hole.par)),
    strokeIndex: holes.map((hole) => hole.strokeIndex),
    distance: withTotals(holes.map((hole) => hole.distance)),
    players: lines.map(({ playerId, name }) => ({
      name,
      playerId,
      scores: withTotals(
        strokes.filter((score) => score.playerId === playerId).map((score) => score.strokes),
      ),
    })),
  };
}

/**
 * Corrige un round (mêmes contrôles que l'import), puis recalcule les stats des joueurs
 * du round avant et après la correction, dans la même transaction.
 */
export function updateRound(db: Db, roundId: number, form: RoundForm) {
  assertCoherent(form);
  db.transaction((tx) => {
    findRound(tx, roundId);
    const previous = playerIdsOf(tx, roundId);
    tx.update(rounds).set(roundColumns(form)).where(eq(rounds.id, roundId)).run();
    tx.delete(scores).where(eq(scores.roundId, roundId)).run();
    tx.delete(roundPlayers).where(eq(roundPlayers.roundId, roundId)).run();
    tx.delete(roundHoles).where(eq(roundHoles.roundId, roundId)).run();
    writeRoundCard(tx, roundId, form);
    recomputeStats(tx, [...previous, ...formPlayerIds(form)]);
  });
}

/** Supprime un round (ses lignes suivent en cascade) et recalcule les index de ses joueurs. */
export function deleteRound(db: Db, roundId: number) {
  db.transaction((tx) => {
    findRound(tx, roundId);
    const previous = playerIdsOf(tx, roundId);
    tx.delete(rounds).where(eq(rounds.id, roundId)).run();
    recomputeStats(tx, previous);
  });
}
