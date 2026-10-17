import { desc } from "drizzle-orm";
import type { Db } from "@/db/client";
import { rounds } from "@/db/schema";
import { roundLeaderboard } from "./leaderboard";

/**
 * Rounds du plus récent au plus ancien par date de jeu (spec `rounds`), avec le brut de
 * chaque joueur et le ou les gagnants nets (vide quand personne n'avait d'index).
 */
export function listRounds(db: Db) {
  return db
    .select({
      id: rounds.id,
      playedOn: rounds.playedOn,
      courseName: rounds.courseName,
      tees: rounds.tees,
    })
    .from(rounds)
    .orderBy(desc(rounds.playedOn), desc(rounds.createdAt), desc(rounds.id))
    .all()
    .map((round) => {
      const leaderboard = roundLeaderboard(db, round.id);
      return {
        ...round,
        players: leaderboard.map(({ name, gross }) => ({ name, gross })),
        netWinners: leaderboard.filter(({ rank }) => rank === 1).map(({ name }) => name),
      };
    });
}
