import type { DraftHoleRow, DraftPlayerRow, DraftValue, ScorecardDraft } from "./draft";

/** Ligne de joueur du formulaire : ce qui a été lu, plus le joueur associé (ou `null`). */
export type RoundFormRow = DraftPlayerRow & { playerId: number | null };

/** Brouillon en cours de correction, avec l'association joueur de chaque ligne. */
export type RoundForm = Omit<ScorecardDraft, "players"> & { players: RoundFormRow[] };

/**
 * Un problème de cohérence et les cases à surligner. Clés de case :
 * `courseName`, `tees`, `playedOn` ; `<ligne>:<trou 1..18 | out | in | total | player>`
 * avec `<ligne>` = `par`, `strokeIndex`, `distance` ou `player<n>` (n = rang de la ligne, dès 0).
 */
export type Problem = { message: string; cells: string[] };

const MAX_PLAYERS = 4;
const EMPTY = "Case vide";

type Range = { min: number; max: number; label: string };
const PAR_RANGE: Range = { min: 3, max: 5, label: "Par" };
const SCORE_RANGE: Range = { min: 1, max: 15, label: "Score" };
const INDEX_RANGE: Range = { min: 1, max: 18, label: "Index" };

const holeKey = (row: string, hole: number) => `${row}:${hole + 1}`;

/** Cases obligatoires : vides ou hors bornes, un problème par case. */
function cellProblems(row: string, values: readonly DraftValue[], range: Range): Problem[] {
  return values.flatMap((value, hole): Problem[] => {
    const cells = [holeKey(row, hole)];
    if (value === null) return [{ message: EMPTY, cells }];
    if (value < range.min || value > range.max) {
      return [{ message: `${range.label} ${value} hors de ${range.min} à ${range.max}`, cells }];
    }
    return [];
  });
}

function totalProblems(row: string, values: DraftHoleRow): Problem[] {
  return (["out", "in", "total"] as const)
    .filter((total) => values[total] === null)
    .map((total) => ({ message: EMPTY, cells: [`${row}:${total}`] }));
}

const sum = (values: readonly DraftValue[]) =>
  values.every((value) => value !== null)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;

/** Ligne de 18 valeurs avec ses totaux OUT, IN et TOT calculés (`null` si une case manque). */
export function withTotals(holes: readonly DraftValue[]): DraftHoleRow {
  const out = sum(holes.slice(0, 9));
  const back = sum(holes.slice(9));
  return { holes: [...holes], out, in: back, total: sum([out, back]) };
}

/** Somme aller = OUT, somme retour = IN, OUT + IN = TOT ; ignorées si une case manque. */
function sumProblems(row: string, values: DraftHoleRow): Problem[] {
  const checks = [
    { label: "Somme aller", from: 0, to: 9, total: "out", printed: "OUT" },
    { label: "Somme retour", from: 9, to: 18, total: "in", printed: "IN" },
  ] as const;
  const problems = checks.flatMap(({ label, from, to, total, printed }) => {
    const computed = sum(values.holes.slice(from, to));
    const read = values[total];
    if (computed === null || read === null || computed === read) return [];
    const cells = values.holes.slice(from, to).map((_, i) => holeKey(row, from + i));
    return [
      {
        message: `${label} ${computed} ≠ ${printed} ${read}`,
        cells: [...cells, `${row}:${total}`],
      },
    ];
  });
  const outIn = sum([values.out, values.in]);
  if (outIn !== null && values.total !== null && outIn !== values.total) {
    problems.push({
      message: `OUT + IN ${outIn} ≠ TOT ${values.total}`,
      cells: [`${row}:out`, `${row}:in`, `${row}:total`],
    });
  }
  return problems;
}

function holeRowProblems(row: string, values: DraftHoleRow, range: Range): Problem[] {
  return [
    ...cellProblems(row, values.holes, range),
    ...totalProblems(row, values),
    ...sumProblems(row, values),
  ];
}

type TextField = "courseName" | "tees" | "playedOn";

function fieldProblems(card: ScorecardDraft, fields: readonly TextField[]): Problem[] {
  return fields
    .filter((field) => !card[field]?.trim())
    .map((field) => ({ message: EMPTY, cells: [field] }));
}

/** Les index doivent former une permutation de 1 à 18 : chaque doublon surligne ses cases. */
function strokeIndexProblems(indexes: readonly DraftValue[]): Problem[] {
  const problems = cellProblems("strokeIndex", indexes, INDEX_RANGE);
  const holesByIndex = new Map<number, number[]>();
  indexes.forEach((value, hole) => {
    if (value !== null) holesByIndex.set(value, [...(holesByIndex.get(value) ?? []), hole]);
  });
  for (const [value, holes] of holesByIndex) {
    if (holes.length > 1) {
      problems.push({
        message: `Index ${value} en double`,
        cells: holes.map((hole) => holeKey("strokeIndex", hole)),
      });
    }
  }
  return problems;
}

function playerCountProblems(rows: readonly DraftPlayerRow[]): Problem[] {
  if (rows.length === 0) return [{ message: "Aucune ligne de joueur", cells: [] }];
  if (rows.length > MAX_PLAYERS) return [{ message: "4 joueurs au plus", cells: [] }];
  return [];
}

function playerScoreProblems(row: DraftPlayerRow, position: number): Problem[] {
  return holeRowProblems(`player${position}`, row.scores, SCORE_RANGE);
}

function unassignedRowProblems(rows: readonly RoundFormRow[]): Problem[] {
  return rows.flatMap(({ playerId }, position) =>
    playerId === null
      ? [{ message: "Ligne sans joueur", cells: [`player${position}:player`] }]
      : [],
  );
}

function duplicatePlayerProblems(rows: readonly RoundFormRow[]): Problem[] {
  const positionsByPlayer = new Map<number, number[]>();
  rows.forEach(({ playerId }, position) => {
    if (playerId !== null) {
      positionsByPlayer.set(playerId, [...(positionsByPlayer.get(playerId) ?? []), position]);
    }
  });
  return [...positionsByPlayer.values()]
    .filter((positions) => positions.length > 1)
    .map((positions) => ({
      message: "Joueur en double",
      cells: positions.map((position) => `player${position}:player`),
    }));
}

/**
 * Contrôles d'un brouillon tel que lu, avant toute association de joueurs : ceux de
 * `checkRoundForm`, sans la date ni les problèmes de joueur. Liste non vide : la lecture
 * locale demande une complétion par IA (spec `scorecard-ai-completion`).
 * La distance, facultative, n'est pas contrôlée : le simulateur arrondit chaque trou, et
 * sur la carte de référence la somme aller (3138) diffère déjà de OUT (3139).
 */
export function checkDraft(draft: ScorecardDraft): Problem[] {
  return [
    ...fieldProblems(draft, ["courseName", "tees"]),
    ...holeRowProblems("par", draft.par, PAR_RANGE),
    ...strokeIndexProblems(draft.strokeIndex),
    ...playerCountProblems(draft.players),
    ...draft.players.flatMap(playerScoreProblems),
  ];
}

/**
 * Contrôles de cohérence d'une carte (spec `scorecard-import`), partagés par l'écran de
 * correction et l'enregistrement côté serveur. Liste vide : la carte peut être enregistrée.
 * Ceux du brouillon, plus la date et l'association des joueurs.
 */
export function checkRoundForm(form: RoundForm): Problem[] {
  return [
    ...checkDraft(form),
    ...fieldProblems(form, ["playedOn"]),
    ...unassignedRowProblems(form.players),
    ...duplicatePlayerProblems(form.players),
  ];
}

/** Libellé du bouton d'enregistrement et du refus serveur : « 1 problème à corriger ». */
export function problemCountLabel(count: number): string {
  return `${count} ${count > 1 ? "problèmes" : "problème"} à corriger`;
}
