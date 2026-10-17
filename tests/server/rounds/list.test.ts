import { describe, expect, it } from "vitest";
import { listRounds } from "@/server/rounds/list";
import { saveRound } from "@/server/rounds/save";
import { referenceForm, roundForm, seededTestDbPerTest, strokesOverPar } from "../../factories";

const testDb = seededTestDbPerTest();

describe("listRounds", () => {
  // Mutation : tri croissant ou par ordre d'enregistrement, gagnant brut au lieu de net,
  // gagnant désigné sans index.
  it("liste du plus récent au plus ancien, avec les bruts et le gagnant net", () => {
    const { Gab, Manu } = testDb.ids;
    const reference = saveRound(testDb.db, referenceForm([Gab, Manu]));
    const earlier = saveRound(
      testDb.db,
      roundForm("2026-10-10", [
        { playerId: Gab, strokes: strokesOverPar(1) },
        { playerId: Manu, strokes: strokesOverPar(17) },
      ]),
    );
    expect(listRounds(testDb.db)).toEqual([
      {
        id: reference,
        playedOn: "2026-10-17",
        courseName: "BETHPAGE BLACK",
        tees: "Red",
        players: [
          { name: "Gab", gross: 72 },
          { name: "Manu", gross: 88 },
        ],
        netWinners: ["Gab", "Manu"],
      },
      {
        id: earlier,
        playedOn: "2026-10-10",
        courseName: "BETHPAGE BLACK",
        tees: "Red",
        players: [
          { name: "Gab", gross: 72 },
          { name: "Manu", gross: 88 },
        ],
        netWinners: [],
      },
    ]);
  });
});
