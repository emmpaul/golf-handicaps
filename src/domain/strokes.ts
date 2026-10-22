import type { CourseRating } from "@/domain/handicap";

/** Handicap de jeu : index (en dixièmes) arrondi à l'entier, 0,5 vers le haut. */
export function playingHandicap(indexT: number): number {
  return Math.floor((indexT + 5) / 10);
}

/** Rating et slope confirmés d'un parcours, avec son par total. */
export interface RatedCourse extends CourseRating {
  par: number;
}

/**
 * Handicap de parcours : index × slope / 113 + (course rating − par), arrondi à l'entier,
 * 0,5 vers le haut (design, décision 1). Sans rating : l'index arrondi (`playingHandicap`).
 */
export function courseHandicap(indexT: number, course?: RatedCourse): number {
  if (course === undefined) return playingHandicap(indexT);
  const { ratingT, slope, par } = course;
  return Math.floor(((indexT * slope) / 113 + ratingT - par * 10) / 10 + 0.5);
}

const HOLES = 18;

/**
 * Coups reçus par trou pour S coups : ⌊S/18⌋ partout, plus 1 sur les trous d'index ≤ S mod 18.
 * Pour −S, rend 1 coup (valeur −1) sur les S trous aux index les plus élevés.
 */
export function allocateStrokes(strokes: number, strokeIndexes: readonly number[]): number[] {
  if (strokes < 0) {
    return allocateStrokes(
      -strokes,
      strokeIndexes.map((index) => HOLES + 1 - index),
    ).map((count) => (count === 0 ? 0 : -count));
  }
  const base = Math.floor(strokes / HOLES);
  const extra = strokes % HOLES;
  return strokeIndexes.map((index) => base + (index <= extra ? 1 : 0));
}

export type StrokeMode = "ecart" | "complet";

/**
 * Coups reçus par joueur. « Complet » : le handicap de jeu entier.
 * « Écart » (défaut) : la différence avec le plus petit handicap de jeu de la partie.
 * Le handicap de jeu est le handicap de parcours, avec la rating du parcours quand elle est confirmée.
 */
export function matchStrokes(
  indexesT: readonly number[],
  mode: StrokeMode = "ecart",
  course?: RatedCourse,
): number[] {
  const handicaps = indexesT.map((indexT) => courseHandicap(indexT, course));
  if (mode === "complet") return handicaps;
  const lowest = Math.min(...handicaps);
  return handicaps.map((handicap) => handicap - lowest);
}
