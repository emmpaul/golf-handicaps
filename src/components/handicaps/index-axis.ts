import { formatTenths } from "@/lib/format";

/** Pas possibles entre deux graduations, en dixièmes : 0,1 · 0,2 · 0,5 · 1 · 2 · 5 · 10. */
const STEPS_T = [1, 2, 5, 10, 20, 50, 100];
const MAX_INTERVALS = 4;

/**
 * Axe vertical de la courbe d'un index : domaine et graduations ronds, au dixième près, quatre
 * intervalles au plus. Un seul round est encadré d'un demi-point de chaque côté. Sans aucune
 * valeur, l'axe est vide : domaine [0, 0], aucune graduation.
 */
export function indexAxis(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 0], ticks: [] };
  const tenths = values.map((value) => Math.round(value * 10));
  let minT = Math.min(...tenths);
  let maxT = Math.max(...tenths);
  if (minT === maxT) {
    minT -= 5;
    maxT += 5;
  }
  const step =
    STEPS_T.find(
      (candidate) => Math.ceil(maxT / candidate) - Math.floor(minT / candidate) <= MAX_INTERVALS,
    ) ?? STEPS_T[STEPS_T.length - 1];
  const loT = Math.floor(minT / step) * step;
  const hiT = Math.ceil(maxT / step) * step;
  const ticks: number[] = [];
  for (let t = loT; t <= hiT; t += step) ticks.push(t / 10);
  return { domain: [loT / 10, hiT / 10], ticks };
}

/** Graduation au dixième, virgule décimale : « 21,5 ». */
export function formatIndexTick(value: number): string {
  return formatTenths(Math.round(value * 10));
}
