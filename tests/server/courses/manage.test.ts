import { describe, expect, it } from "vitest";
import {
  CourseRatingInputError,
  chooseCandidate,
  chooseTee,
  confirmProposal,
  courseRatingOverview,
  relaunchSearch,
  saveManualRating,
} from "@/server/courses/manage";
import { saveRound } from "@/server/rounds/save";
import { referenceForm, roundForm, seededTestDbPerTest, strokesOverPar } from "../../factories";

const testDb = seededTestDbPerTest();

const NOW = new Date("2026-10-21T08:00:00.000Z");

/**
 * Refus d'une saisie : `CourseRatingInputError` (que l'action traduit en message affiché),
 * avec ce message exact.
 */
function expectRefused(write: () => unknown, message: string) {
  let thrown: unknown;
  try {
    write();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(CourseRatingInputError);
  expect((thrown as Error).message).toBe(message);
}

/** Tees lus sur la carte SGT de Bethpage Black (id 30), en dixièmes (design, Context). */
const BETHPAGE_TEES = [
  { name: "Blue", ratingT: 775, slope: 155 },
  { name: "White", ratingT: 742, slope: 148 },
  { name: "Red", ratingT: 714, slope: 144 },
];

/**
 * Carte IMG_3064 enregistrée pour Gab et Manu (ligne `pending` « BETHPAGE BLACK / Red » créée
 * par `saveRound`), puis cette ligne mise dans l'état `values`. Rend l'id de la ligne.
 */
function bethpageRow(values: Record<string, string | number | null>): number {
  saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]));
  const { id } = testDb.sqlite.prepare("SELECT id FROM course_ratings").get() as { id: number };
  const columns = Object.keys(values);
  testDb.sqlite
    .prepare(
      `UPDATE course_ratings SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    )
    .run(...Object.values(values), id);
  // Le job mis en file par `saveRound` n'intéresse pas ces tests.
  testDb.sqlite.prepare("DELETE FROM jobs").run();
  return id;
}

const proposedRed = () =>
  bethpageRow({
    status: "proposed",
    sgt_course_id: 30,
    sgt_course_name: "Bethpage Black",
    sgt_course_location: "Farmingdale, NY",
    tees_read: JSON.stringify(BETHPAGE_TEES),
    proposed_tee: "Red",
  });

const ratingRow = (id: number) =>
  testDb.sqlite
    .prepare(
      `SELECT rating_t, slope, source, status, sgt_course_id, sgt_course_name, sgt_course_location,
              proposed_tee, note FROM course_ratings WHERE id = ?`,
    )
    .get(id);

/** Différentiels (en dixièmes) de Gab puis Manu, par round dans l'ordre des ids. */
const differentials = () =>
  testDb.sqlite
    .prepare(
      `SELECT s.round_id, p.name, s.differential_t FROM player_round_stats s
       JOIN players p ON p.id = s.player_id ORDER BY s.round_id, p.name`,
    )
    .all();

const courseRatingJobs = () =>
  testDb.sqlite
    .prepare("SELECT type, payload, status, run_after FROM jobs ORDER BY id")
    .all()
    .map((row) => ({ ...(row as object) }));

/** Un seul job en file : la recherche `course-rating` de la ligne `id`, à lancer tout de suite. */
const oneQueuedJob = (id: number) => [
  {
    type: "course-rating",
    payload: JSON.stringify({ courseRatingId: id }),
    status: "queued",
    run_after: NOW.getTime(),
  },
];

describe("confirmProposal", () => {
  // Mutation : `recomputeStats` retiré (Manu reste à 170), slope et rating d'un autre tee que
  // `proposed_tee` (le premier lu, Blue 775 / 155), ou `source` à `manual`.
  it("écrit 71,4 / 144 du tee Red, source sgt, et passe Manu de 17,0 à 13,0 sur IMG_3064", () => {
    const id = proposedRed();
    expect(differentials()).toEqual([
      { round_id: 1, name: "Gab", differential_t: 10 },
      { round_id: 1, name: "Manu", differential_t: 170 },
    ]);
    confirmProposal(testDb.db, id, NOW);
    expect(ratingRow(id)).toEqual({
      rating_t: 714,
      slope: 144,
      source: "sgt",
      status: "confirmed",
      sgt_course_id: 30,
      sgt_course_name: "Bethpage Black",
      sgt_course_location: "Farmingdale, NY",
      proposed_tee: "Red",
      note: null,
    });
    expect(differentials()).toEqual([
      { round_id: 1, name: "Gab", differential_t: 5 },
      { round_id: 1, name: "Manu", differential_t: 130 },
    ]);
  });

  // Recalcul de tous les joueurs du parcours (spec `course-rating`), casse comprise.
  // Mutation : joueurs du parcours cherchés sur le texte exact de la ligne (« BETHPAGE BLACK /
  // Red ») au lieu de `lower(trim(...))` : le round de Sean sur « bethpage black / red » garde 170.
  it("recalcule aussi Sean, dont le round est sur « bethpage black / red »", () => {
    const id = proposedRed();
    saveRound(
      testDb.db,
      roundForm("2026-10-18", [{ playerId: testDb.ids.Sean, strokes: strokesOverPar(17) }], {
        courseName: "bethpage black",
        tees: " red ",
      }),
    );
    confirmProposal(testDb.db, id, NOW);
    expect(differentials()).toEqual([
      { round_id: 1, name: "Gab", differential_t: 5 },
      { round_id: 1, name: "Manu", differential_t: 130 },
      // 113 × (880 − 714) / 144 = 130,3 → 130.
      { round_id: 2, name: "Sean", differential_t: 130 },
    ]);
  });

  // Mutation : confirmer sans proposition écrit `null` ou plante sur un `undefined`.
  it("refuse une ligne sans proposition et n'écrit rien", () => {
    const id = bethpageRow({ status: "not_found" });
    expectRefused(() => confirmProposal(testDb.db, id, NOW), "Aucune proposition à confirmer");
    expect(ratingRow(id)).toEqual({
      rating_t: null,
      slope: null,
      source: null,
      status: "not_found",
      sgt_course_id: null,
      sgt_course_name: null,
      sgt_course_location: null,
      proposed_tee: null,
      note: null,
    });
  });
});

describe("saveManualRating", () => {
  // Mutation : borne du slope à 160 au lieu de 155, ou message de la rating.
  it("refuse un slope de 160 avec « Slope entre 55 et 155 » et n'enregistre rien", () => {
    const id = proposedRed();
    expectRefused(
      () => saveManualRating(testDb.db, id, { rating: "71,4", slope: "160" }, NOW),
      "Slope entre 55 et 155",
    );
    expect(ratingRow(id)).toEqual({
      rating_t: null,
      slope: null,
      source: null,
      status: "proposed",
      sgt_course_id: 30,
      sgt_course_name: "Bethpage Black",
      sgt_course_location: "Farmingdale, NY",
      proposed_tee: "Red",
      note: null,
    });
  });

  // Mutation : slope non entier accepté (`Number` sans contrôle), ou borne basse à 50.
  for (const slope of ["54", "144,5", ""]) {
    it(`refuse le slope « ${slope} »`, () => {
      const id = proposedRed();
      expectRefused(
        () => saveManualRating(testDb.db, id, { rating: "71,4", slope }, NOW),
        "Slope entre 55 et 155",
      );
    });
  }

  // Mutation : bornes de la rating élargies (90,1 accepté), deux décimales arrondies au lieu
  // d'être refusées, ou texte vide lu comme 0.
  for (const rating of ["39,9", "90,1", "71,45", "abc", ""]) {
    it(`refuse la rating « ${rating} » avec « Rating entre 40,0 et 90,0 »`, () => {
      const id = proposedRed();
      expectRefused(
        () => saveManualRating(testDb.db, id, { rating, slope: "144" }, NOW),
        "Rating entre 40,0 et 90,0",
      );
      expect(ratingRow(id)).toMatchObject({ rating_t: null, slope: null });
    });
  }

  // Mutation : virgule décimale refusée (seul le point lu), `source` à `sgt`, ou pas de recalcul.
  it("enregistre « 70,0 » / « 130 » en manual confirmé et recalcule Manu à 15,6", () => {
    const id = proposedRed();
    saveManualRating(testDb.db, id, { rating: " 70,0 ", slope: "130" }, NOW);
    expect(ratingRow(id)).toEqual({
      rating_t: 700,
      slope: 130,
      source: "manual",
      status: "confirmed",
      sgt_course_id: 30,
      sgt_course_name: "Bethpage Black",
      sgt_course_location: "Farmingdale, NY",
      proposed_tee: "Red",
      note: null,
    });
    // Gab 72 → 113 × (720 − 700) / 130 = 17,4 → 17 ; Manu 88 → 113 × 180 / 130 = 156,5 → 156.
    expect(differentials()).toEqual([
      { round_id: 1, name: "Gab", differential_t: 17 },
      { round_id: 1, name: "Manu", differential_t: 156 },
    ]);
  });

  // Bornes incluses. Mutation : `<` au lieu de `<=` sur l'une des bornes.
  it("accepte les bornes 40,0 / 55 et 90.0 / 155", () => {
    const id = proposedRed();
    saveManualRating(testDb.db, id, { rating: "40,0", slope: "55" }, NOW);
    expect(ratingRow(id)).toMatchObject({ rating_t: 400, slope: 55 });
    saveManualRating(testDb.db, id, { rating: "90.0", slope: "155" }, NOW);
    expect(ratingRow(id)).toMatchObject({ rating_t: 900, slope: 155 });
  });
});

describe("chooseTee", () => {
  // Mutation : tee de `proposed_tee` ou premier tee lu retenu au lieu du tee choisi.
  it("retient White 74,2 / 148 sur une ligne choose_tee et recalcule Manu à 10,5", () => {
    const id = bethpageRow({
      status: "choose_tee",
      sgt_course_id: 30,
      sgt_course_name: "Bethpage Black",
      sgt_course_location: "Farmingdale, NY",
      tees_read: JSON.stringify(BETHPAGE_TEES),
    });
    chooseTee(testDb.db, id, "White", NOW);
    expect(ratingRow(id)).toEqual({
      rating_t: 742,
      slope: 148,
      source: "sgt",
      status: "confirmed",
      sgt_course_id: 30,
      sgt_course_name: "Bethpage Black",
      sgt_course_location: "Farmingdale, NY",
      proposed_tee: "White",
      note: null,
    });
    // Manu 88 → 113 × (880 − 742) / 148 = 105,4 → 105.
    expect(differentials()).toEqual([
      { round_id: 1, name: "Gab", differential_t: -17 },
      { round_id: 1, name: "Manu", differential_t: 105 },
    ]);
  });

  // Mutation : tee inconnu accepté (rating `undefined` écrite).
  it("refuse un tee absent des tees lus", () => {
    const id = bethpageRow({
      status: "choose_tee",
      sgt_course_id: 30,
      tees_read: JSON.stringify(BETHPAGE_TEES),
    });
    expectRefused(() => chooseTee(testDb.db, id, "Gold", NOW), "Tee absent de la carte SGT");
    expect(ratingRow(id)).toMatchObject({ rating_t: null, slope: null, status: "choose_tee" });
  });
});

const SANCTUARY_CANDIDATES = [
  { id: 477, name: "Sanctuary", location: "Sedalia, Colorado", par: 72 },
  { id: 3291, name: "The Sanctuary Golf Course", location: "Kansas", par: 72 },
];

describe("chooseCandidate", () => {
  // Mutation : job non mis en file, `sgt_course_id` non écrit (le job referait la
  // correspondance par nom), nom et lieu SGT du candidat non écrits (le lien The Course View
  // et la confirmation n'auraient pas le nom SGT), ou statut laissé à choose_course.
  it("retient le candidat 3291, remet la ligne en pending et met un job en file", () => {
    const id = bethpageRow({
      status: "choose_course",
      candidates: JSON.stringify(SANCTUARY_CANDIDATES),
      note: "Plusieurs parcours",
    });
    chooseCandidate(testDb.db, id, 3291, NOW);
    expect(ratingRow(id)).toEqual({
      rating_t: null,
      slope: null,
      source: null,
      status: "pending",
      sgt_course_id: 3291,
      sgt_course_name: "The Sanctuary Golf Course",
      sgt_course_location: "Kansas",
      proposed_tee: null,
      note: null,
    });
    expect(courseRatingJobs()).toEqual(oneQueuedJob(id));
  });

  // Mutation : n'importe quel id SGT accepté.
  it("refuse un parcours SGT absent des candidats et ne met rien en file", () => {
    const id = bethpageRow({
      status: "choose_course",
      candidates: JSON.stringify(SANCTUARY_CANDIDATES),
    });
    expectRefused(
      () => chooseCandidate(testDb.db, id, 30, NOW),
      "Parcours SGT absent des candidats",
    );
    expect(ratingRow(id)).toMatchObject({ status: "choose_course", sgt_course_id: null });
    expect(courseRatingJobs()).toEqual([]);
  });
});

describe("relaunchSearch", () => {
  // Spec `course-rating`, « Recherche relancée sur un parcours confirmé ».
  // Mutation : `rating_t` / `slope` / `source` remis à null, job non mis en file, ou
  // `sgt_course_id` gardé (le job ne referait que la lecture de la même carte), ou nom et
  // lieu SGT gardés sans l'id.
  it("remet un parcours confirmé à 71,4 / 144 en pending, garde sa rating et met un job en file", () => {
    const id = bethpageRow({
      status: "confirmed",
      rating_t: 714,
      slope: 144,
      source: "sgt",
      sgt_course_id: 30,
      sgt_course_name: "Bethpage Black",
      sgt_course_location: "Farmingdale, NY",
      proposed_tee: "Red",
      note: "SGT injoignable",
    });
    relaunchSearch(testDb.db, id, NOW);
    expect(ratingRow(id)).toEqual({
      rating_t: 714,
      slope: 144,
      source: "sgt",
      status: "pending",
      sgt_course_id: null,
      sgt_course_name: null,
      sgt_course_location: null,
      proposed_tee: "Red",
      note: null,
    });
    expect(courseRatingJobs()).toEqual(oneQueuedJob(id));
  });

  // Mutation : id inconnu ignoré en silence (un job en file pour une ligne absente).
  it("refuse un parcours inconnu", () => {
    proposedRed();
    expectRefused(() => relaunchSearch(testDb.db, 999, NOW), "Parcours introuvable");
    expect(courseRatingJobs()).toEqual([]);
  });
});

describe("courseRatingOverview", () => {
  // Page Parcours (spec `course-rating`) : un parcours par paire connue, sa ligne de rating
  // trouvée sans tenir compte de la casse. Mutation : proposition lue sur le premier tee lu,
  // par du premier round au lieu du plus récent, ou lien de carte sans l'id SGT retenu.
  it("liste Bethpage Black / Red avec sa proposition Red 71,4 / 144 et le lien de sa carte", () => {
    const id = proposedRed();
    saveRound(
      testDb.db,
      roundForm("2026-10-01", [{ playerId: testDb.ids.Sean, strokes: strokesOverPar(3) }], {
        courseName: "PAYNES VALLEY",
        tees: "Blue",
      }),
    );
    expect(courseRatingOverview(testDb.db)).toEqual([
      {
        id,
        courseName: "BETHPAGE BLACK",
        tees: "Red",
        par: 71,
        ratingT: null,
        slope: null,
        source: null,
        status: "proposed",
        note: null,
        sgtCourseName: "Bethpage Black",
        sgtCourseLocation: "Farmingdale, NY",
        proposal: { name: "Red", ratingT: 714, slope: 144 },
        teesRead: BETHPAGE_TEES,
        candidates: [],
        scorecardUrl:
          "https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_30.jpg",
        courseViewUrl: "https://thecourseview.com/courses/bethpage-black",
      },
      {
        id: id + 1,
        courseName: "PAYNES VALLEY",
        tees: "Blue",
        par: 71,
        ratingT: null,
        slope: null,
        source: null,
        status: "pending",
        note: null,
        sgtCourseName: null,
        sgtCourseLocation: null,
        proposal: null,
        teesRead: [],
        candidates: [],
        scorecardUrl: null,
        courseViewUrl: null,
      },
    ]);
  });

  // Design, décision 4 : slug Course View tiré du nom SGT. Mutation : slug tiré du nom du
  // round (« THE SANCTUARY » → `the-sanctuary`).
  it("donne pour « THE SANCTUARY » le lien Course View du parcours SGT « Sanctuary »", () => {
    saveRound(
      testDb.db,
      roundForm("2026-10-01", [{ playerId: testDb.ids.Sean, strokes: strokesOverPar(3) }], {
        courseName: "THE SANCTUARY",
        tees: "White",
      }),
    );
    testDb.sqlite
      .prepare(
        `UPDATE course_ratings SET status = 'manual', sgt_course_id = 477,
         sgt_course_name = 'Sanctuary', sgt_course_location = 'Sedalia, CO'`,
      )
      .run();
    expect(courseRatingOverview(testDb.db)).toMatchObject([
      {
        courseName: "THE SANCTUARY",
        sgtCourseName: "Sanctuary",
        sgtCourseLocation: "Sedalia, CO",
        scorecardUrl:
          "https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_477.jpg",
        courseViewUrl: "https://thecourseview.com/courses/sanctuary",
      },
    ]);
  });
});
