import type { Db } from "@/db/client";
import { type RoundForm, withTotals } from "@/scorecard/checks";
import { listPlayers } from "@/server/players/players";
import { saveRound } from "./save";

/** Carte de référence IMG_3064 (Bethpage Black, tees Red, 17 octobre 2026), lue telle quelle. */
const REFERENCE_ROUND = {
  courseName: "BETHPAGE BLACK",
  tees: "Red",
  playedOn: "2026-10-17",
  pars: [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 4, 3, 4],
  strokeIndexes: [8, 16, 18, 2, 4, 10, 6, 14, 12, 9, 11, 7, 3, 17, 1, 5, 13, 15],
  distances: [
    420, 344, 128, 444, 398, 377, 480, 155, 392, 353, 405, 392, 470, 149, 401, 423, 173, 337,
  ],
  lines: [
    { player: "Gab", strokes: [5, 5, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 4, 3, 4, 5, 3, 3] },
    { player: "Manu", strokes: [7, 5, 3, 7, 6, 5, 5, 3, 5, 3, 6, 5, 7, 4, 5, 4, 3, 5] },
  ],
};

/** Seeder de `pnpm db:reset` : le round de référence, après les joueurs initiaux. */
export function seedReferenceRound(db: Db) {
  const ids = new Map(listPlayers(db).map(({ id, name }) => [name, id]));
  const { pars, strokeIndexes, distances, lines, ...course } = REFERENCE_ROUND;
  const form: RoundForm = {
    ...course,
    par: withTotals(pars),
    strokeIndex: strokeIndexes,
    distance: withTotals(distances),
    players: lines.map(({ player, strokes }) => ({
      name: player.toUpperCase(),
      playerId: ids.get(player) ?? null,
      scores: withTotals(strokes),
    })),
  };
  saveRound(db, form);
}
