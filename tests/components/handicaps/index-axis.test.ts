import { describe, expect, it } from "vitest";
import { formatIndexTick, indexAxis } from "@/components/handicaps/index-axis";

const labels = (values: number[]) => indexAxis(values).ticks.map(formatIndexTick);

// Spec du change `hallmark-custom-redesign`, tâche 4.6 : graduations de la courbe d'index arrondies
// au dixième, avec une virgule. Mutations : `String(value)` comme format (« 21.5 ») ; pas de 0,5
// retiré des pas possibles (graduations d'un point entier) ; domaine laissé à recharts (« 21.25 »).
describe("indexAxis", () => {
  it("gradue 21,3 à 22,9 par demi-point, de 21,0 à 23,0", () => {
    expect(labels([21.3, 22.9])).toEqual(["21,0", "21,5", "22,0", "22,5", "23,0"]);
    expect(indexAxis([21.3, 22.9]).domain).toEqual([21, 23]);
  });

  it("gradue un index de 2,6 à 6,5 de deux en deux", () => {
    expect(labels([4.9, 6.5, 2.6, 3.6, 4.0])).toEqual(["2,0", "4,0", "6,0", "8,0"]);
  });

  it("encadre un seul round d'un demi-point de chaque côté", () => {
    expect(labels([25])).toEqual(["24,5", "25,0", "25,5"]);
    expect(indexAxis([25]).domain).toEqual([24.5, 25.5]);
  });

  it("garde le signe des index négatifs", () => {
    expect(labels([-1, 1])).toEqual(["-1,0", "-0,5", "0,0", "0,5", "1,0"]);
  });

  it("ne produit jamais de décimale au-delà du dixième", () => {
    expect(labels([17.4, 17.6])).toEqual(["17,4", "17,5", "17,6"]);
  });

  // Mutation : garde des valeurs vides retirée (domaine [Infinity, -Infinity]).
  it("rend un axe vide, domaine [0, 0], sans aucune valeur", { timeout: 1000 }, () => {
    expect(indexAxis([])).toEqual({ domain: [0, 0], ticks: [] });
  });
});
