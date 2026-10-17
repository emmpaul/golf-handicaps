/** Handicap de jeu : index (en dixièmes) arrondi à l'entier, 0,5 vers le haut. */
export function playingHandicap(indexT: number): number {
  return Math.floor((indexT + 5) / 10);
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
 */
export function matchStrokes(indexesT: readonly number[], mode: StrokeMode = "ecart"): number[] {
  const handicaps = indexesT.map(playingHandicap);
  if (mode === "complet") return handicaps;
  const lowest = Math.min(...handicaps);
  return handicaps.map((handicap) => handicap - lowest);
}
