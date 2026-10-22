import { describe, expect, it } from "vitest";
import { allocateStrokes, courseHandicap, matchStrokes, playingHandicap } from "@/domain/strokes";
import { referenceCard } from "../factories";

describe("playingHandicap", () => {
  // Mutation : troncature (Math.trunc) au lieu d'arrondi 0,5 vers le haut, ou oubli de la division par 10.
  it.each([
    { indexT: 174, expected: 17 },
    { indexT: 10, expected: 1 },
    { indexT: 125, expected: 13 },
    { indexT: 0, expected: 0 },
    { indexT: -15, expected: -1 },
    { indexT: -16, expected: -2 },
  ])("index $indexT dixièmes donne $expected", ({ indexT, expected }) => {
    expect(playingHandicap(indexT)).toBe(expected);
  });
});

/** Bethpage Black / Red confirmé : rating 71,4, slope 144, par 71. */
const bethpageRed = { ratingT: 714, slope: 144, par: 71 };

describe("courseHandicap", () => {
  // Mutations : (ratingT − par × 10) retiré (1, 22, −3 au lieu de 2, 23, −2), slope ignoré.
  it.each([
    { indexT: 10, expected: 2 },
    { indexT: 174, expected: 23 },
    { indexT: -20, expected: -2 },
  ])("index $indexT dixièmes donne $expected sur Bethpage Black / Red", ({ indexT, expected }) => {
    expect(courseHandicap(indexT, bethpageRed)).toBe(expected);
  });

  // Mutation : sans rating, index rendu tel quel (10 et 174) au lieu de l’index arrondi.
  it.each([
    { indexT: 10, expected: 1 },
    { indexT: 174, expected: 17 },
  ])("index $indexT dixièmes donne $expected sans rating", ({ indexT, expected }) => {
    expect(courseHandicap(indexT)).toBe(expected);
  });
});

describe("allocateStrokes — Bethpage Black / Red", () => {
  // Trous 1 à 18 ; index 8,16,18,2,4,10,6,14,12,9,11,7,3,17,1,5,13,15.
  // Mutation : index < S mod 18 au lieu de ≤, ⌊S/18⌋ oublié, coups rendus sur les index les plus bas.
  it.each([
    { strokes: 0, perHole: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { strokes: 1, perHole: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
    { strokes: 16, perHole: [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1] },
    { strokes: 18, perHole: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    { strokes: 20, perHole: [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1] },
    { strokes: 36, perHole: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2] },
    { strokes: -2, perHole: [0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0] },
  ])("$strokes coups", ({ strokes, perHole }) => {
    expect(allocateStrokes(strokes, referenceCard.strokeIndexes)).toEqual(perHole);
  });
});

describe("matchStrokes", () => {
  // Mutation : modes inversés, Écart relatif au max ou à l'index brut au lieu du handicap de jeu minimum.
  it.each([
    {
      name: "Gab 1,0 et Manu 17,4 en Écart",
      indexesT: [10, 174],
      mode: "ecart",
      expected: [0, 16],
    },
    {
      name: "Gab 1,0 et Manu 17,4 en Complet",
      indexesT: [10, 174],
      mode: "complet",
      expected: [1, 17],
    },
    {
      name: "trois joueurs en Écart",
      indexesT: [125, 10, 174],
      mode: "ecart",
      expected: [12, 0, 16],
    },
    { name: "joueur plus 2 en Écart", indexesT: [-16, 10], mode: "ecart", expected: [0, 3] },
    { name: "joueur plus 2 en Complet", indexesT: [-16, 10], mode: "complet", expected: [-2, 1] },
  ] as const)("$name : $expected", ({ indexesT, mode, expected }) => {
    expect(matchStrokes(indexesT, mode)).toEqual(expected);
  });

  // Mutation : rating ignorée par matchStrokes ([0, 16] et [1, 17]).
  it.each([
    { mode: "ecart", expected: [0, 21] },
    { mode: "complet", expected: [2, 23] },
  ] as const)(
    "Gab 1,0 et Manu 17,4 sur Bethpage Black / Red en $mode : $expected",
    ({ mode, expected }) => {
      expect(matchStrokes([10, 174], mode, bethpageRed)).toEqual(expected);
    },
  );

  // Mutation : mode par défaut Complet.
  it("utilise le mode Écart par défaut", () => {
    expect(matchStrokes([10, 174])).toEqual([0, 16]);
  });
});
