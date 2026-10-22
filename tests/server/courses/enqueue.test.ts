import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enqueueMissingCourseRatings } from "@/server/courses/enqueue";
import { createTestDb, type TestDb } from "../../factories";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.cleanup();
});

const NOW = new Date("2026-10-21T08:00:00.000Z");

/** Les 6 paires parcours / tees de la prod (design, Context), dont « Blue » et « Blue 6212yd ». */
const PROD_PAIRS = [
  ["BETHPAGE BLACK", "Red"],
  ["CALANOVA GOLF CLUB", "Yellow"],
  ["PAYNES VALLEY", "Blue"],
  ["PAYNES VALLEY", "Blue 6212yd"],
  ["THE SANCTUARY", "White"],
  ["TUALATIN COUNTRY CLUB", "White 6023yd"],
] as const;

/** Round sans trous ni joueurs, inséré sans passer par `saveRound` (qui met déjà en file). */
function insertRound(courseName: string, tees: string, playedOn: string) {
  testDb.sqlite
    .prepare("INSERT INTO rounds (course_name, tees, played_on, created_at) VALUES (?, ?, ?, 0)")
    .run(courseName, tees, playedOn);
}

function insertProdRounds() {
  for (const [courseName, tees] of PROD_PAIRS) insertRound(courseName, tees, "2026-10-10");
  // Septième round, même paire que le premier en autre casse : pas de septième recherche.
  insertRound("bethpage black", " red ", "2026-10-17");
}

const ratingRows = () =>
  testDb.sqlite
    .prepare("SELECT course_name, tees, status FROM course_ratings ORDER BY course_name, tees")
    .all();
const jobRows = () =>
  testDb.sqlite
    .prepare(
      `SELECT c.course_name, c.tees, j.status, j.run_after FROM jobs j
       JOIN course_ratings c ON c.id = json_extract(j.payload, '$.courseRatingId')
       WHERE j.type = 'course-rating' ORDER BY c.course_name, c.tees`,
    )
    .all();
const jobCount = () =>
  (testDb.sqlite.prepare("SELECT count(*) AS n FROM jobs").get() as { n: number }).n;

describe("enqueueMissingCourseRatings", () => {
  // Mutation : tees comparés après retrait de la distance (« Blue 6212yd » fusionné avec
  // « Blue »), une ligne par round au lieu d'une par paire, ou texte du round le plus récent
  // (« bethpage black / red ») au lieu du premier (design, décision 2).
  it("met en file une recherche par paire de la prod, « Blue » et « Blue 6212yd » à part", () => {
    insertProdRounds();
    expect(enqueueMissingCourseRatings(testDb.db, NOW)).toBe(6);
    expect(jobCount()).toBe(6);
    expect(jobRows()).toEqual(
      PROD_PAIRS.map(([course_name, tees]) => ({
        course_name,
        tees,
        status: "queued",
        run_after: NOW.getTime(),
      })),
    );
    expect(ratingRows()).toHaveLength(6);
  });

  // Mutation : job mis en file pour une paire qui a déjà sa ligne.
  it("ne met rien de plus en file au second appel", () => {
    insertProdRounds();
    enqueueMissingCourseRatings(testDb.db, NOW);
    expect(enqueueMissingCourseRatings(testDb.db, NOW)).toBe(0);
    expect(jobCount()).toBe(6);
    expect(ratingRows()).toHaveLength(6);
  });

  // Mutation : ligne existante réécrite (statut remis à `pending`, rating confirmée perdue).
  it("laisse intacte la ligne confirmée d'une paire déjà couverte, en autre casse", () => {
    insertProdRounds();
    testDb.sqlite
      .prepare(
        `INSERT INTO course_ratings (course_name, tees, rating_t, slope, source, status, updated_at)
         VALUES ('Bethpage Black', 'RED', 714, 144, 'sgt', 'confirmed', 0)`,
      )
      .run();
    expect(enqueueMissingCourseRatings(testDb.db, NOW)).toBe(5);
    expect(
      testDb.sqlite
        .prepare(
          "SELECT rating_t, slope, source, status FROM course_ratings WHERE course_name = 'Bethpage Black'",
        )
        .all(),
    ).toEqual([{ rating_t: 714, slope: 144, source: "sgt", status: "confirmed" }]);
    expect(jobCount()).toBe(5);
  });
});
