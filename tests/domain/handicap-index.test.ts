import { describe, expect, it } from "vitest";
import { computeIndex, type RoundDifferential } from "@/domain/handicap";

/** Rounds joués un jour après l'autre, dans l'ordre du tableau. */
function history(differentials: readonly number[]): RoundDifferential[] {
  return differentials.map((differentialT, i) => ({
    playedOn: `2026-01-${String(i + 1).padStart(2, "0")}`,
    createdAt: "2026-02-01T10:00:00.000Z",
    differentialT,
  }));
}

/** 20 différentiels distincts ; les n premiers forment un historique de n rounds. */
const twenty = [
  170, 120, 200, 150, 140, 180, 160, 130, 190, 110, 175, 125, 165, 135, 185, 115, 155, 145, 195,
  105,
];

describe("computeIndex — table WHS", () => {
  // Mutation : une ligne de la table fausse (nombre de meilleurs ou ajustement), ou arrondi vers le bas.
  it.each([
    { n: 1, indexT: 170, provisional: true },
    { n: 2, indexT: 145, provisional: true },
    { n: 3, indexT: 100, provisional: false },
    { n: 4, indexT: 110, provisional: false },
    { n: 5, indexT: 120, provisional: false },
    { n: 6, indexT: 120, provisional: false },
    { n: 7, indexT: 130, provisional: false },
    { n: 8, indexT: 125, provisional: false },
    { n: 9, indexT: 130, provisional: false },
    { n: 10, indexT: 120, provisional: false },
    { n: 11, indexT: 120, provisional: false },
    { n: 12, indexT: 121, provisional: false },
    { n: 13, indexT: 121, provisional: false },
    { n: 14, indexT: 121, provisional: false },
    { n: 15, indexT: 124, provisional: false },
    { n: 16, indexT: 120, provisional: false },
    { n: 17, indexT: 123, provisional: false },
    { n: 18, indexT: 123, provisional: false },
    { n: 19, indexT: 125, provisional: false },
    { n: 20, indexT: 123, provisional: false },
  ])("$n rounds donnent $indexT (provisoire : $provisional)", ({ n, indexT, provisional }) => {
    const result = computeIndex(history(twenty.slice(0, n)));
    expect({ indexT: result.indexT, provisional: result.provisional }).toEqual({
      indexT,
      provisional,
    });
  });
});

describe("computeIndex — scénarios de la spec", () => {
  // Mutation : ajustement de 3 ou 6 rounds oublié, moyenne provisoire remplacée par le meilleur,
  // arrondi 0,05 vers le bas, plafond absent, valeurs négatives ramenées à 0.
  it.each([
    { name: "trois rounds", diffs: [170, 120, 200], indexT: 100, provisional: false },
    { name: "six rounds", diffs: [170, 120, 200, 150, 140, 180], indexT: 120, provisional: false },
    { name: "deux rounds", diffs: [170, 120], indexT: 145, provisional: true },
    { name: "aucun round", diffs: [], indexT: null, provisional: false },
    {
      name: "arrondi 13,25",
      diffs: [140, 145, 200, 200, 200, 200],
      indexT: 133,
      provisional: false,
    },
    { name: "plafond 61,0", diffs: [630, 700, 650], indexT: 540, provisional: false },
    { name: "index négatif", diffs: [-10, 50, 60], indexT: -30, provisional: false },
  ])("$name : index $indexT", ({ diffs, indexT, provisional }) => {
    const result = computeIndex(history(diffs));
    expect({ indexT: result.indexT, provisional: result.provisional }).toEqual({
      indexT,
      provisional,
    });
  });
});

describe("computeIndex — 20 derniers rounds et différentiels retenus", () => {
  const oldestIsBest = history([0, ...twenty]);
  const reversed = [...oldestIsBest].reverse();
  const sameDayByCreation = oldestIsBest
    .map((round, i) => ({
      ...round,
      playedOn: "2026-03-01",
      createdAt: `2026-03-01T10:${String(i).padStart(2, "0")}:00.000Z`,
    }))
    .reverse();

  // Mutation : pas de limite à 20, tri ignoré (ordre du tableau), ou created_at ignoré à date égale.
  it.each([
    { name: "dans l'ordre", rounds: oldestIsBest },
    { name: "fournis en ordre inverse", rounds: reversed },
    { name: "le même jour, départagés par created_at", rounds: sameDayByCreation },
  ])("21 rounds $name : le plus ancien (0,0) est exclu", ({ rounds }) => {
    const result = computeIndex(rounds);
    expect(result.indexT).toBe(123);
    expect(
      rounds
        .filter((_, i) => result.counts[i])
        .map((r) => r.differentialT)
        .sort((a, b) => a - b),
    ).toEqual([105, 110, 115, 120, 125, 130, 135, 140]);
  });

  // Mutation : marquer les pires, ou tous les rounds de la fenêtre.
  it.each([
    {
      name: "6 rounds : les 2 meilleurs",
      diffs: [170, 120, 200, 150, 140, 180],
      counts: [false, true, false, false, true, false],
    },
    { name: "2 rounds provisoires : tous", diffs: [170, 120], counts: [true, true] },
    { name: "aucun round", diffs: [], counts: [] },
  ])("$name comptent", ({ diffs, counts }) => {
    expect(computeIndex(history(diffs)).counts).toEqual(counts);
  });
});
