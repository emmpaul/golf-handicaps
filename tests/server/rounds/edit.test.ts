import { describe, expect, it } from "vitest";
import { listImports } from "@/server/imports/list";
import { deleteRound, getRoundForm, RoundNotFoundError, updateRound } from "@/server/rounds/edit";
import { listRounds } from "@/server/rounds/list";
import { RoundCheckError, saveRound } from "@/server/rounds/save";
import { referenceForm, roundForm, seededTestDbPerTest, strokesOverPar } from "../../factories";

const testDb = seededTestDbPerTest();

const statsOf = (playerId: number) =>
  testDb.sqlite
    .prepare(
      `SELECT r.played_on, s.gross, s.differential_t, s.index_after_t
       FROM player_round_stats s JOIN rounds r ON r.id = s.round_id
       WHERE s.player_id = ? ORDER BY r.played_on`,
    )
    .all(playerId);

/** Manu a déjà un round à 17,0 le 10, puis le round de référence (88, 17,0) le 17. */
function manuHistory() {
  const { Gab, Manu } = testDb.ids;
  saveRound(testDb.db, roundForm("2026-10-10", [{ playerId: Manu, strokes: strokesOverPar(17) }]));
  return saveRound(testDb.db, referenceForm([Gab, Manu]));
}

describe("getRoundForm", () => {
  // Mutation : totaux non recalculés, joueur ou ordre des lignes perdus, index de trou mal relu.
  it("relit un round enregistré sous forme de formulaire, totaux recalculés", () => {
    const { Gab, Manu } = testDb.ids;
    const form = getRoundForm(testDb.db, saveRound(testDb.db, referenceForm([Gab, Manu])));
    expect(form.courseName).toBe("BETHPAGE BLACK");
    expect(form.par).toEqual({
      holes: [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 4, 3, 4],
      out: 36,
      in: 35,
      total: 71,
    });
    expect(form.strokeIndex).toEqual([
      8, 16, 18, 2, 4, 10, 6, 14, 12, 9, 11, 7, 3, 17, 1, 5, 13, 15,
    ]);
    expect(
      form.players.map(({ name, playerId, scores }) => ({ name, playerId, total: scores.total })),
    ).toEqual([
      { name: "Gab", playerId: Gab, total: 72 },
      { name: "Manu", playerId: Manu, total: 88 },
    ]);
  });
});

describe("updateRound", () => {
  // Mutation : stats non recalculées après correction, ou ancien score conservé.
  it("Manu trou 1 de 7 à 6 : brut 87, différentiel 16,0 et index recalculé à 16,5", () => {
    const id = manuHistory();
    const form = getRoundForm(testDb.db, id);
    const manu = form.players[1].scores;
    manu.holes[0] = 6;
    manu.out = 45;
    manu.total = 87;
    updateRound(testDb.db, id, form);
    expect(statsOf(testDb.ids.Manu)).toEqual([
      { played_on: "2026-10-10", gross: 88, differential_t: 170, index_after_t: 170 },
      { played_on: "2026-10-17", gross: 87, differential_t: 160, index_after_t: 165 },
    ]);
  });

  // Mutation : seuls les joueurs du nouveau formulaire recalculés (Manu garde ses stats du round).
  it("recalcule aussi le joueur retiré du round", () => {
    const id = manuHistory();
    const form = getRoundForm(testDb.db, id);
    form.players[1].playerId = testDb.ids.Sean;
    updateRound(testDb.db, id, form);
    expect(statsOf(testDb.ids.Manu)).toEqual([
      { played_on: "2026-10-10", gross: 88, differential_t: 170, index_after_t: 170 },
    ]);
    expect(statsOf(testDb.ids.Sean)).toEqual([
      { played_on: "2026-10-17", gross: 88, differential_t: 170, index_after_t: 170 },
    ]);
  });

  // Mutation : correction enregistrée sans rejouer les contrôles de cohérence.
  it("refuse une correction incohérente et laisse le round inchangé", () => {
    const id = manuHistory();
    const form = getRoundForm(testDb.db, id);
    form.players[1].scores.holes[0] = 6;
    expect(() => updateRound(testDb.db, id, form)).toThrow(RoundCheckError);
    expect(getRoundForm(testDb.db, id).players[1].scores.holes[0]).toBe(7);
  });
});

describe("deleteRound", () => {
  // Mutation : round supprimé sans recalcul (index après les rounds suivants inchangés).
  it("retire le round et recalcule les index sans lui", () => {
    const { Gab } = testDb.ids;
    const gabPlays = (playedOn: string, over: number) =>
      saveRound(testDb.db, roundForm(playedOn, [{ playerId: Gab, strokes: strokesOverPar(over) }]));
    const first = gabPlays("2026-10-01", 20);
    gabPlays("2026-10-10", 17);
    gabPlays("2026-10-17", 12);
    deleteRound(testDb.db, first);
    expect(listRounds(testDb.db).map(({ playedOn }) => playedOn)).toEqual([
      "2026-10-17",
      "2026-10-10",
    ]);
    expect(statsOf(Gab)).toEqual([
      { played_on: "2026-10-10", gross: 88, differential_t: 170, index_after_t: 170 },
      { played_on: "2026-10-17", gross: 83, differential_t: 120, index_after_t: 145 },
    ]);
  });

  /** Import `id` dont la photo est `uploads/<id>.webp`, encore sans round. */
  const importIn = (id: number, status: string) =>
    testDb.sqlite
      .prepare(
        "INSERT INTO imports (id, status, photo_path, corners, created_at) VALUES (?, ?, ?, '{}', 0)",
      )
      .run(id, status, `uploads/${id}.webp`);
  const listedImports = () => listImports(testDb.db).map(({ id, roundId }) => ({ id, roundId }));

  // Mutation : import non supprimé, il reste dans la liste avec `roundId: null` (« Prêt à
  // vérifier »), ou photo du round non renvoyée.
  it("emporte l'import d'un round importé et renvoie la photo du round", () => {
    importIn(7, "ready");
    const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]), {
      importId: 7,
    });
    expect(deleteRound(testDb.db, id)).toEqual({ photoPath: "uploads/7.webp" });
    expect(listedImports()).toEqual([]);
    expect(testDb.sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(0);
  });

  // Mutation : supprimer tous les imports sans round, ou ignorer le filtre sur `round_id`.
  it("laisse la liste des imports inchangée pour un round saisi à la main", () => {
    importIn(8, "failed");
    const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]));
    expect(deleteRound(testDb.db, id)).toEqual({ photoPath: null });
    expect(listedImports()).toEqual([{ id: 8, roundId: null }]);
  });
});

describe("round introuvable", () => {
  // Mutation : opération silencieuse sur un id inexistant.
  it.each([
    ["la relecture", () => getRoundForm(testDb.db, 404)],
    ["la correction", () => updateRound(testDb.db, 404, referenceForm([1, 2]))],
    ["la suppression", () => deleteRound(testDb.db, 404)],
  ])("%s lève « Round introuvable »", (_name, operation) => {
    expect(operation).toThrow(RoundNotFoundError);
    expect(operation).toThrow(/^Round introuvable$/);
  });
});

const ratingPairs = () =>
  testDb.sqlite.prepare("SELECT course_name, tees, status FROM course_ratings ORDER BY id").all();
const courseRatingJobs = () =>
  testDb.sqlite
    .prepare(
      `SELECT c.course_name FROM jobs j
       JOIN course_ratings c ON c.id = json_extract(j.payload, '$.courseRatingId')
       WHERE j.type = 'course-rating' ORDER BY j.id`,
    )
    .all();

/** Round de référence (Gab, Manu) enregistré, puis corrigé avec `changes`. */
function correctReferenceRound(changes: Partial<ReturnType<typeof getRoundForm>>) {
  const { Gab, Manu } = testDb.ids;
  const id = saveRound(testDb.db, referenceForm([Gab, Manu]));
  updateRound(testDb.db, id, { ...getRoundForm(testDb.db, id), ...changes });
}

describe("updateRound — recherche de rating", () => {
  // Mutation : mise en file absente de `updateRound`, ou faite avec l'ancien nom du round.
  it("met en file la nouvelle paire quand la correction change le nom du parcours", () => {
    correctReferenceRound({ courseName: "CALANOVA GOLF CLUB", tees: "Yellow" });
    expect(ratingPairs()).toEqual([
      { course_name: "BETHPAGE BLACK", tees: "Red", status: "pending" },
      { course_name: "CALANOVA GOLF CLUB", tees: "Yellow", status: "pending" },
    ]);
    expect(courseRatingJobs()).toEqual([
      { course_name: "BETHPAGE BLACK" },
      { course_name: "CALANOVA GOLF CLUB" },
    ]);
  });

  // Mutation : job mis en file à chaque correction, même sans nouvelle paire.
  it("ne met rien de plus en file quand la correction garde le parcours", () => {
    correctReferenceRound({ playedOn: "2026-10-16" });
    expect(testDb.sqlite.prepare("SELECT type, payload FROM jobs").all()).toEqual([
      { type: "course-rating", payload: '{"courseRatingId":1}' },
    ]);
  });
});
