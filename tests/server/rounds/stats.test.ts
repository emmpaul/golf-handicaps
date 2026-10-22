import { describe, expect, it } from "vitest";
import { saveRound } from "@/server/rounds/save";
import { referenceForm, seededTestDbPerTest } from "../../factories";

const testDb = seededTestDbPerTest();

/** Différentiels (en dixièmes) de Gab et Manu sur la carte de référence IMG_3064. */
function referenceDifferentials() {
  const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]));
  return testDb.sqlite
    .prepare(
      "SELECT player_id, differential_t FROM player_round_stats WHERE round_id = ? ORDER BY gross",
    )
    .all(id);
}

describe("recomputePlayerStats — rating du parcours (spec `handicap-index`)", () => {
  // Mutation : rating proposée (`tees_read`) utilisée sans confirmation.
  it("IMG_3064 sans rating confirmée : Gab 1,0 et Manu 17,0", () => {
    testDb.sqlite
      .prepare(
        `INSERT INTO course_ratings (course_name, tees, status, tees_read, updated_at)
         VALUES ('BETHPAGE BLACK', 'Red', 'proposed', '[{"name":"Red","ratingT":714,"slope":144}]', 0)`,
      )
      .run();
    expect(referenceDifferentials()).toEqual([
      { player_id: testDb.ids.Gab, differential_t: 10 },
      { player_id: testDb.ids.Manu, differential_t: 170 },
    ]);
  });

  // Mutation : `recomputePlayerStats` garde le repli (par, 113) au lieu d'appeler `ratingFor`,
  // ou cherche la rating sans tenir compte de la casse du parcours du round.
  it("IMG_3064 avec 71,4 / 144 confirmé sur « Bethpage Black / red » : Gab 0,5 et Manu 13,0", () => {
    testDb.sqlite
      .prepare(
        `INSERT INTO course_ratings (course_name, tees, rating_t, slope, source, status, updated_at)
         VALUES ('Bethpage Black', 'red', 714, 144, 'sgt', 'confirmed', 0)`,
      )
      .run();
    expect(referenceDifferentials()).toEqual([
      { player_id: testDb.ids.Gab, differential_t: 5 },
      { player_id: testDb.ids.Manu, differential_t: 130 },
    ]);
  });
});
