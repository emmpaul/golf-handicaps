import { describe, expect, it } from "vitest";
import { adjustedHoleScore, adjustedScore, differentialTenths } from "@/domain/handicap";
import { referenceCard } from "../factories";

const { pars, scores } = referenceCard;

describe("adjustedHoleScore", () => {
  // Mutation : plafond à par + 3 ou par + 5, ou pas de plafond.
  it.each([
    [10, 4, 8],
    [8, 4, 8],
    [7, 4, 7],
    [9, 5, 9],
    [10, 5, 9],
    [3, 3, 3],
  ])("%i coups sur un par %i comptent %i", (strokes, par, expected) => {
    expect(adjustedHoleScore(strokes, par)).toBe(expected);
  });
});

describe("adjustedScore", () => {
  // Mutation : somme des coups bruts (ou plafond oublié dans la somme).
  it.each([
    { name: "Gab", strokes: scores.gab, expected: 72 },
    { name: "Manu", strokes: scores.manu, expected: 88 },
    {
      name: "Manu avec 10 au trou 1 (par 4)",
      strokes: [10, ...scores.manu.slice(1)],
      expected: 89,
    },
  ])("$name sur la carte de référence vaut $expected", ({ strokes, expected }) => {
    expect(adjustedScore(strokes, pars)).toBe(expected);
  });
});

describe("differentialTenths", () => {
  // Mutation : différentiel en unités (1, 17) au lieu de dixièmes, ou brut au lieu d'ajusté.
  it.each([
    { name: "Gab", strokes: scores.gab, expected: 10 },
    { name: "Manu", strokes: scores.manu, expected: 170 },
    {
      name: "Manu avec 10 au trou 1 (par 4)",
      strokes: [10, ...scores.manu.slice(1)],
      expected: 180,
    },
    { name: "un round sous le par", strokes: [3, ...scores.gab.slice(1)], expected: -10 },
  ])("$name obtient $expected dixièmes sur la carte de référence", ({ strokes, expected }) => {
    expect(differentialTenths(strokes, pars)).toBe(expected);
  });
});
