import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ratingFor } from "@/server/courses/ratings";
import { createTestDb, type TestDb } from "../../factories";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.cleanup();
});

/** Ligne de `course_ratings` pour « BETHPAGE BLACK / Red ». */
function insertBethpageRed(row: {
  status: string;
  ratingT: number | null;
  slope: number | null;
  teesRead: string | null;
}) {
  testDb.sqlite
    .prepare(
      `INSERT INTO course_ratings (course_name, tees, rating_t, slope, status, tees_read, updated_at)
       VALUES ('BETHPAGE BLACK', 'Red', ?, ?, ?, ?, 0)`,
    )
    .run(row.ratingT, row.slope, row.status, row.teesRead);
}

describe("ratingFor", () => {
  // Mutation : lire `tees_read` au lieu de `rating_t` / `slope` (720 / 140 au lieu de 714 / 144),
  // ou comparer nom et tees sans `lower(trim(...))`.
  it("rend la rating confirmée de « BETHPAGE BLACK / Red » pour « bethpage black / RED »", () => {
    insertBethpageRed({
      status: "confirmed",
      ratingT: 714,
      slope: 144,
      teesRead: '[{"name":"Red","ratingT":720,"slope":140}]',
    });
    expect(ratingFor(testDb.db, " bethpage black ", "RED", 71)).toEqual({
      ratingT: 714,
      slope: 144,
      rated: true,
    });
  });

  // Mutation : repli sur un autre par (72 en dur) ou slope 100.
  it("se replie sur par × 10 et slope 113 sans ligne pour le parcours", () => {
    expect(ratingFor(testDb.db, "BETHPAGE BLACK", "Red", 71)).toEqual({
      ratingT: 710,
      slope: 113,
      rated: false,
    });
  });

  // Mutation : lire `tees_read` au lieu de `rating_t` (la proposition 71,4 / 144 serait utilisée).
  it("se replie sur par × 10 et slope 113 avec une ligne proposed non confirmée", () => {
    insertBethpageRed({
      status: "proposed",
      ratingT: null,
      slope: null,
      teesRead: '[{"name":"Red","ratingT":714,"slope":144}]',
    });
    expect(ratingFor(testDb.db, "BETHPAGE BLACK", "Red", 71)).toEqual({
      ratingT: 710,
      slope: 113,
      rated: false,
    });
  });

  // Recherche relancée sur un parcours confirmé (spec `course-rating`) : la rating reste.
  // Mutation : ne retenir que les lignes au statut `confirmed`.
  it("garde la rating confirmée d'une ligne remise en pending par une recherche relancée", () => {
    insertBethpageRed({ status: "pending", ratingT: 714, slope: 144, teesRead: null });
    expect(ratingFor(testDb.db, "BETHPAGE BLACK", "Red", 71)).toEqual({
      ratingT: 714,
      slope: 144,
      rated: true,
    });
  });
});
