import { describe, expect, it } from "vitest";
import { saveRound } from "@/server/rounds/save";
import { roundForm, seededTestDbPerTest, strokesOverPar } from "../../factories";

const testDb = seededTestDbPerTest();

/** Un round de Gab seul, `over` coups au-dessus du par 71 (différentiel over × 10). */
const gabPlays = (playedOn: string, over: number) =>
  saveRound(
    testDb.db,
    roundForm(playedOn, [{ playerId: testDb.ids.Gab, strokes: strokesOverPar(over) }]),
  );

const gabHistory = () =>
  testDb.sqlite
    .prepare(
      `SELECT r.played_on, s.differential_t, s.index_before_t, s.index_after_t, s.counts_in_current
       FROM player_round_stats s JOIN rounds r ON r.id = s.round_id
       WHERE s.player_id = ? ORDER BY r.played_on`,
    )
    .all(testDb.ids.Gab);

describe("recalcul de l'historique", () => {
  // Mutation : seul le nouveau round est calculé, ou historique rejoué dans l'ordre d'enregistrement.
  it("un round ajouté avant les autres change index_after_t des rounds suivants", () => {
    gabPlays("2026-10-10", 17);
    gabPlays("2026-10-17", 12);
    gabPlays("2026-10-01", 20);
    expect(gabHistory()).toEqual([
      {
        played_on: "2026-10-01",
        differential_t: 200,
        index_before_t: null,
        index_after_t: 200,
        counts_in_current: 0,
      },
      {
        played_on: "2026-10-10",
        differential_t: 170,
        index_before_t: 200,
        index_after_t: 185,
        counts_in_current: 0,
      },
      {
        played_on: "2026-10-17",
        differential_t: 120,
        index_before_t: 185,
        index_after_t: 100,
        counts_in_current: 1,
      },
    ]);
  });

  // Mutation : counts_in_current laissé à faux, ou marqué sur les pires différentiels.
  it("counts_in_current marque les 2 meilleurs différentiels sur 6 rounds", () => {
    [17, 12, 20, 15, 14, 18].forEach((over, day) => {
      gabPlays(`2026-10-0${day + 1}`, over);
    });
    expect(
      gabHistory().map((row) => (row as { counts_in_current: number }).counts_in_current),
    ).toEqual([0, 1, 0, 0, 1, 0]);
  });
});
