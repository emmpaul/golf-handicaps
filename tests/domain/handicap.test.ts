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

/** Repli sans rating confirmée : course rating = par total (71), slope 113. */
const unrated = { ratingT: 710, slope: 113 };
/** Bethpage Black / Red confirmé : rating 71,4, slope 144. */
const bethpageRed = { ratingT: 714, slope: 144 };

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
    expect(differentialTenths(strokes, pars, unrated)).toBe(expected);
  });
});

describe("differentialTenths avec rating", () => {
  // Mutations : slope et 113 inversés (8 et 189), rating ignorée (10 et 170 au lieu de 5 et 130),
  // Math.floor sans + 0,5 (4 pour Gab).
  it.each([
    { name: "Gab", strokes: scores.gab, expected: 5 },
    { name: "Manu", strokes: scores.manu, expected: 130 },
  ])(
    "$name obtient $expected dixièmes sur Bethpage Black / Red (71,4 / 144)",
    ({ strokes, expected }) => {
      expect(differentialTenths(strokes, pars, bethpageRed)).toBe(expected);
    },
  );
});
