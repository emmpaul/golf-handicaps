import { describe, expect, it } from "vitest";
import type { RoundForm } from "@/scorecard/checks";
import { findDuplicateRound, knownCourses } from "@/server/rounds/courses";
import { saveRound } from "@/server/rounds/save";
import { referenceCard, referenceForm, seededTestDbPerTest } from "../../factories";

const testDb = seededTestDbPerTest();

const reference = () => referenceForm([testDb.ids.Gab, testDb.ids.Manu]);

describe("knownCourses", () => {
  // Mutation : parcours identifié par son seul nom (Red et Blue fusionnés).
  it("sépare « Bethpage Black / Red » et « Bethpage Black / Blue »", () => {
    saveRound(testDb.db, reference());
    saveRound(testDb.db, { ...reference(), tees: "Blue", playedOn: "2026-10-10" });
    expect(
      knownCourses(testDb.db).map(({ courseName, tees }) => `${courseName} / ${tees}`),
    ).toEqual(["BETHPAGE BLACK / Blue", "BETHPAGE BLACK / Red"]);
  });

  // Mutation : casse prise en compte (2 entrées), ou valeurs du round enregistré en dernier
  // au lieu du plus récent par date de jeu.
  it("prend pars, index et distances du round le plus récent, sans tenir compte de la casse", () => {
    saveRound(testDb.db, reference());
    const older = reference();
    older.courseName = "Bethpage Black";
    older.tees = "red";
    older.playedOn = "2026-10-01";
    older.par.holes[0] = 5;
    older.par.holes[1] = 3;
    older.distance.holes[0] = 999;
    saveRound(testDb.db, older);
    expect(knownCourses(testDb.db)).toEqual([
      {
        courseName: "BETHPAGE BLACK",
        tees: "Red",
        pars: referenceCard.pars,
        strokeIndexes: referenceCard.strokeIndexes,
        distances: [
          420, 344, 128, 444, 398, 377, 480, 155, 392, 353, 405, 392, 470, 149, 401, 423, 173, 337,
        ],
      },
    ]);
  });
});

describe("findDuplicateRound", () => {
  // Mutation : un critère ignoré (date, tees, brut, joueurs) ou comparaison sensible à la casse.
  it.each<[string, boolean, (form: RoundForm) => void]>([
    ["la même carte", true, () => undefined],
    [
      "le même parcours écrit autrement",
      true,
      (form) => {
        form.courseName = " bethpage black ";
        form.tees = "RED";
      },
    ],
    [
      "une autre date",
      false,
      (form) => {
        form.playedOn = "2026-10-18";
      },
    ],
    [
      "d'autres tees",
      false,
      (form) => {
        form.tees = "Blue";
      },
    ],
    [
      "un autre brut pour Manu",
      false,
      (form) => {
        form.players[1].scores.holes[0] = 6;
      },
    ],
    [
      "un joueur de plus",
      false,
      (form) => {
        form.players.push({ ...form.players[0], playerId: testDb.ids.Sean });
      },
    ],
  ])("%s : doublon %s", (_name, duplicate, change) => {
    const existing = saveRound(testDb.db, reference());
    const form = reference();
    change(form);
    expect(findDuplicateRound(testDb.db, form)).toBe(duplicate ? existing : null);
  });

  // Mutation : un round corrigé se signale lui-même comme doublon.
  it("ignore le round en cours de correction", () => {
    const existing = saveRound(testDb.db, reference());
    expect(findDuplicateRound(testDb.db, reference(), { excludeRoundId: existing })).toBeNull();
  });
});
