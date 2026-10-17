const MAX_OVER_PAR = 4;

export function adjustedHoleScore(strokes: number, par: number): number {
  return Math.min(strokes, par + MAX_OVER_PAR);
}

export function adjustedScore(strokes: readonly number[], pars: readonly number[]): number {
  return strokes.reduce((sum, s, hole) => sum + adjustedHoleScore(s, pars[hole]), 0);
}

/** Différentiel en dixièmes entiers : (score ajusté − par total) × 10, slope fixé à 113. */
export function differentialTenths(strokes: readonly number[], pars: readonly number[]): number {
  const totalPar = pars.reduce((sum, par) => sum + par, 0);
  return (adjustedScore(strokes, pars) - totalPar) * 10;
}

export interface RoundDifferential {
  playedOn: string;
  createdAt: string;
  differentialT: number;
}

export interface HandicapIndex {
  indexT: number | null;
  provisional: boolean;
  counts: boolean[];
}

const WINDOW = 20;
const MAX_INDEX_T = 540;

/** Table WHS : pour n rounds (3 à 20), nombre de meilleurs différentiels retenus et ajustement en dixièmes. */
function whsRule(n: number): { best: number; adjustmentT: number } {
  if (n <= 3) return { best: 1, adjustmentT: -20 };
  if (n === 4) return { best: 1, adjustmentT: -10 };
  if (n === 5) return { best: 1, adjustmentT: 0 };
  if (n === 6) return { best: 2, adjustmentT: -10 };
  if (n <= 8) return { best: 2, adjustmentT: 0 };
  if (n <= 11) return { best: 3, adjustmentT: 0 };
  if (n <= 14) return { best: 4, adjustmentT: 0 };
  if (n <= 16) return { best: 5, adjustmentT: 0 };
  if (n <= 18) return { best: 6, adjustmentT: 0 };
  if (n === 19) return { best: 7, adjustmentT: 0 };
  return { best: 8, adjustmentT: 0 };
}

/** Arrondi au dixième entier le plus proche (0,05 vers le haut), plafonné à 54,0. */
function roundIndexT(rawT: number): number {
  return Math.min(Math.floor(rawT + 0.5), MAX_INDEX_T);
}

function chronological(a: RoundDifferential, b: RoundDifferential): number {
  if (a.playedOn !== b.playedOn) return a.playedOn < b.playedOn ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return 0;
}

/**
 * Index d'un joueur sur ses 20 derniers rounds (triés par date de jeu puis created_at).
 * `counts` est aligné sur l'ordre de `rounds` et marque les différentiels retenus.
 */
export function computeIndex(rounds: readonly RoundDifferential[]): HandicapIndex {
  const counts = rounds.map(() => false);
  const recent = rounds
    .map((round, position) => ({ round, position }))
    .sort((a, b) => chronological(a.round, b.round))
    .slice(-WINDOW);
  const n = recent.length;
  if (n === 0) return { indexT: null, provisional: false, counts };

  const provisional = n < 3;
  const rule = provisional ? { best: n, adjustmentT: 0 } : whsRule(n);
  const retained = [...recent]
    .sort((a, b) => a.round.differentialT - b.round.differentialT)
    .slice(0, rule.best);
  for (const { position } of retained) counts[position] = true;

  const sumT = retained.reduce((sum, { round }) => sum + round.differentialT, 0);
  return { indexT: roundIndexT(sumT / rule.best + rule.adjustmentT), provisional, counts };
}
