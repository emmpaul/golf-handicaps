import { describe, expect, it } from "vitest";
import { ImportNotFoundError, RoundCheckError, saveRound } from "@/server/rounds/save";
import { referenceForm, seededTestDbPerTest } from "../../factories";

const testDb = seededTestDbPerTest();

const all = (query: string, ...params: unknown[]) => testDb.sqlite.prepare(query).all(...params);
const roundCount = () => all("SELECT id FROM rounds").length;

describe("saveRound — round de référence", () => {
  // Mutation : photo de l'import non reprise, ou import non relié au round créé.
  it("enregistre parcours, tees, date, garde la photo de l'import et relie l'import au round", () => {
    testDb.sqlite
      .prepare(
        "INSERT INTO imports (id, status, photo_path, corners, created_at) VALUES (7, 'ready', 'uploads/ref.jpg', '{}', 0)",
      )
      .run();
    const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]), {
      importId: 7,
    });
    expect(all("SELECT round_id FROM imports WHERE id = 7")).toEqual([{ round_id: id }]);
    expect(
      all("SELECT course_name, tees, played_on, photo_path FROM rounds WHERE id = ?", id),
    ).toEqual([
      {
        course_name: "BETHPAGE BLACK",
        tees: "Red",
        played_on: "2026-10-17",
        photo_path: "uploads/ref.jpg",
      },
    ]);
  });

  // Mutation : trous décalés d'un rang, index ou distance non écrits.
  it("écrit le par, l'index et la distance de chacun des 18 trous", () => {
    const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]));
    const holes = all(
      "SELECT hole, par, stroke_index, distance FROM round_holes WHERE round_id = ? ORDER BY hole",
      id,
    );
    expect(holes).toHaveLength(18);
    expect(holes.slice(0, 2)).toEqual([
      { hole: 1, par: 4, stroke_index: 8, distance: 420 },
      { hole: 2, par: 4, stroke_index: 16, distance: 344 },
    ]);
    expect(holes.at(-1)).toEqual({ hole: 18, par: 4, stroke_index: 15, distance: 337 });
  });

  // Mutation : ordre des lignes perdu, scores écrits pour le mauvais joueur.
  it("écrit les joueurs dans l'ordre des lignes et les 18 scores de Manu", () => {
    const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]));
    expect(
      all("SELECT player_id, position FROM round_players WHERE round_id = ? ORDER BY position", id),
    ).toEqual([
      { player_id: testDb.ids.Gab, position: 0 },
      { player_id: testDb.ids.Manu, position: 1 },
    ]);
    expect(
      all(
        "SELECT strokes FROM scores WHERE round_id = ? AND player_id = ? ORDER BY hole",
        id,
        testDb.ids.Manu,
      ).map((row) => (row as { strokes: number }).strokes),
    ).toEqual([7, 5, 3, 7, 6, 5, 5, 3, 5, 3, 6, 5, 7, 4, 5, 4, 3, 5]);
  });

  // Mutation : stats non recalculées, brut au lieu d'ajusté, différentiel non multiplié par 10.
  it("calcule 72 et 88 bruts, différentiels 10 et 170, premiers index provisoires", () => {
    const id = saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]));
    expect(
      all(
        `SELECT player_id, gross, adjusted, differential_t, index_before_t, index_after_t,
                counts_in_current FROM player_round_stats WHERE round_id = ? ORDER BY gross`,
        id,
      ),
    ).toEqual([
      {
        player_id: testDb.ids.Gab,
        gross: 72,
        adjusted: 72,
        differential_t: 10,
        index_before_t: null,
        index_after_t: 10,
        counts_in_current: 1,
      },
      {
        player_id: testDb.ids.Manu,
        gross: 88,
        adjusted: 88,
        differential_t: 170,
        index_before_t: null,
        index_after_t: 170,
        counts_in_current: 1,
      },
    ]);
  });
});

describe("saveRound — refus", () => {
  // Mutation : contrôle 5.1 non rejoué côté serveur, ou Error simple au lieu de RoundCheckError.
  it("refuse une carte incohérente avec les problèmes du contrôle, sans rien écrire", () => {
    const save = () => saveRound(testDb.db, referenceForm([testDb.ids.Gab, null]));
    expect(save).toThrow(RoundCheckError);
    expect(save).toThrow(/^1 problème à corriger$/);
    try {
      save();
    } catch (error) {
      expect((error as RoundCheckError).problems).toEqual([
        { message: "Ligne sans joueur", cells: ["player1:player"] },
      ]);
    }
    expect(roundCount()).toBe(0);
  });

  // Mutation : import inconnu ignoré (round enregistré sans photo).
  it("refuse un import inconnu, sans rien écrire", () => {
    const save = () =>
      saveRound(testDb.db, referenceForm([testDb.ids.Gab, testDb.ids.Manu]), { importId: 404 });
    expect(save).toThrow(ImportNotFoundError);
    expect(save).toThrow(/^Import introuvable$/);
    expect(roundCount()).toBe(0);
  });

  // Mutation : écritures hors transaction (le round reste sans ses joueurs).
  it("n'écrit rien quand un joueur inconnu fait échouer l'écriture", () => {
    expect(() => saveRound(testDb.db, referenceForm([testDb.ids.Gab, 999]))).toThrow(
      /FOREIGN KEY constraint failed/,
    );
    expect(roundCount()).toBe(0);
  });
});
