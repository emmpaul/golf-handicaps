import { describe, expect, it } from "vitest";
import { rankNet, roundLeaderboard } from "@/server/rounds/leaderboard";
import { saveRound } from "@/server/rounds/save";
import { referenceCard, roundForm, seededTestDbPerTest, strokesOverPar } from "../../factories";

describe("rankNet", () => {
  // Mutation : handicap de jeu tronqué (174 → 17 ok, mais 125 → 12), net = brut + handicap,
  // rang distinct pour des nets égaux, joueur sans index classé.
  it("Gab (10) et Manu (174) à 72 et 88 sont à 71 net, premiers ex æquo ; sans index : non classé", () => {
    expect(
      rankNet([
        { gross: 72, indexBeforeT: 10 },
        { gross: 88, indexBeforeT: 174 },
        { gross: 80, indexBeforeT: null },
      ]),
    ).toEqual([
      { gross: 72, indexBeforeT: 10, playingHandicap: 1, net: 71, rank: 1 },
      { gross: 88, indexBeforeT: 174, playingHandicap: 17, net: 71, rank: 1 },
      { gross: 80, indexBeforeT: null, playingHandicap: null, net: null, rank: null },
    ]);
  });

  // Mutation : rang dense (1, 2, 2, 3) au lieu du rang de compétition, ou tri décroissant.
  it("après deux ex æquo au 2e rang, le joueur suivant est 4e", () => {
    expect(
      rankNet([
        { gross: 80, indexBeforeT: 0 },
        { gross: 75, indexBeforeT: 50 },
        { gross: 72, indexBeforeT: 125 },
        { gross: 70, indexBeforeT: 0 },
      ]).map(({ net, rank }) => ({ net, rank })),
    ).toEqual([
      { net: 80, rank: 4 },
      { net: 70, rank: 2 },
      { net: 59, rank: 1 },
      { net: 70, rank: 2 },
    ]);
  });
});

describe("roundLeaderboard", () => {
  const testDb = seededTestDbPerTest();

  // Mutation : index pris après le round (index_after_t) au lieu d'avant, ou lignes dans le désordre.
  it("classe le round de référence avec l'index de chacun juste avant ce round", () => {
    const { Gab, Manu, Sean } = testDb.ids;
    saveRound(
      testDb.db,
      roundForm("2026-10-10", [
        { playerId: Gab, strokes: strokesOverPar(1) },
        { playerId: Manu, strokes: strokesOverPar(17) },
      ]),
    );
    const id = saveRound(
      testDb.db,
      roundForm("2026-10-17", [
        { playerId: Gab, strokes: referenceCard.scores.gab },
        { playerId: Manu, strokes: referenceCard.scores.manu },
        { playerId: Sean, strokes: strokesOverPar(10) },
      ]),
    );
    expect(roundLeaderboard(testDb.db, id)).toEqual([
      {
        playerId: Gab,
        name: "Gab",
        gross: 72,
        indexBeforeT: 10,
        playingHandicap: 1,
        net: 71,
        rank: 1,
      },
      {
        playerId: Manu,
        name: "Manu",
        gross: 88,
        indexBeforeT: 170,
        playingHandicap: 17,
        net: 71,
        rank: 1,
      },
      {
        playerId: Sean,
        name: "Sean",
        gross: 81,
        indexBeforeT: null,
        playingHandicap: null,
        net: null,
        rank: null,
      },
    ]);
  });
});
