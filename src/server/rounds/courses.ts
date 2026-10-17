import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerRoundStats, roundHoles, rounds } from "@/db/schema";
import type { RoundForm } from "@/scorecard/checks";

const sameText = (column: typeof rounds.courseName | typeof rounds.tees, value: string) =>
  sql`lower(trim(${column})) = lower(trim(${value}))`;

const courseKey = (courseName: string, tees: string) =>
  `${courseName.trim().toLowerCase()}\u0000${tees.trim().toLowerCase()}`;

/**
 * Parcours connus (spec `rounds`) : un par paire (nom, tees) sans tenir compte de la casse,
 * avec pars, index et distances du round le plus récent joué sur ce parcours et ces tees.
 */
export function knownCourses(db: Db) {
  const latest = new Map<string, typeof rounds.$inferSelect>();
  const all = db
    .select()
    .from(rounds)
    .orderBy(desc(rounds.playedOn), desc(rounds.createdAt), desc(rounds.id))
    .all();
  for (const round of all) {
    const key = courseKey(round.courseName, round.tees);
    if (!latest.has(key)) latest.set(key, round);
  }
  return [...latest.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, round]) => {
      const holes = db
        .select()
        .from(roundHoles)
        .where(eq(roundHoles.roundId, round.id))
        .orderBy(asc(roundHoles.hole))
        .all();
      return {
        courseName: round.courseName,
        tees: round.tees,
        pars: holes.map((hole) => hole.par),
        strokeIndexes: holes.map((hole) => hole.strokeIndex),
        distances: holes.map((hole) => hole.distance),
      };
    });
}

/** Signature comparable « joueur:brut » d'un ensemble de lignes, indépendante de leur ordre. */
const grossSignature = (lines: readonly { playerId: number | null; gross: number }[]) =>
  lines
    .map(({ playerId, gross }) => `${playerId}:${gross}`)
    .sort()
    .join(",");

/**
 * Round déjà enregistré avec le même parcours, les mêmes tees, la même date et les mêmes
 * bruts pour les mêmes joueurs (spec `scorecard-import`, détection de doublon), ou `null`.
 */
export function findDuplicateRound(
  db: Db,
  form: RoundForm,
  options: { excludeRoundId?: number } = {},
): number | null {
  const wanted = grossSignature(
    form.players.map(({ playerId, scores }) => ({
      playerId,
      gross: scores.holes.reduce<number>((total, strokes) => total + (strokes ?? 0), 0),
    })),
  );
  const candidates = db
    .select({ id: rounds.id })
    .from(rounds)
    .where(
      and(
        sameText(rounds.courseName, form.courseName ?? ""),
        sameText(rounds.tees, form.tees ?? ""),
        eq(rounds.playedOn, form.playedOn ?? ""),
        options.excludeRoundId === undefined ? undefined : ne(rounds.id, options.excludeRoundId),
      ),
    )
    .orderBy(asc(rounds.id))
    .all();
  const duplicate = candidates.find(({ id }) => {
    const lines = db
      .select({ playerId: playerRoundStats.playerId, gross: playerRoundStats.gross })
      .from(playerRoundStats)
      .where(eq(playerRoundStats.roundId, id))
      .all();
    return grossSignature(lines) === wanted;
  });
  return duplicate?.id ?? null;
}
