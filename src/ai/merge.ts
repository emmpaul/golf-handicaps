import type { Problem } from "@/scorecard/checks";
import type { DraftHoleRow, DraftPlayerRow, DraftValue, ScorecardDraft } from "@/scorecard/draft";
import type { AiCard } from "./card";

export type MergedDraft = {
  draft: ScorecardDraft;
  /** Clés des cases dont la valeur vient de l'IA (format des clés de `Problem`). */
  aiCells: string[];
};

const TOTALS = ["out", "in", "total"] as const;

const holeKey = (row: string, hole: number) => `${row}:${hole + 1}`;

/** Fusion en cours : cases éligibles, et cases reprises de l'IA dans l'ordre de la carte. */
type Merge = { eligible: ReadonlySet<string>; aiCells: string[] };

/**
 * Valeur de l'IA si la case est en problème et que l'IA y lit une autre valeur, sinon la valeur
 * locale. Une valeur égale à la locale n'est pas marquée : elle ne vient pas de l'IA.
 */
function pick<T extends DraftValue | string>(
  merge: Merge,
  key: string,
  local: T | null,
  ai: T | null,
): T | null {
  if (!merge.eligible.has(key) || ai === null || ai === "" || ai === local) return local;
  merge.aiCells.push(key);
  return ai;
}

function mergeHoles(
  merge: Merge,
  row: string,
  local: readonly DraftValue[],
  ai: readonly DraftValue[],
): DraftValue[] {
  return local.map((value, hole) => pick(merge, holeKey(row, hole), value, ai[hole] ?? null));
}

function mergeRow(merge: Merge, row: string, local: DraftHoleRow, ai: DraftHoleRow): DraftHoleRow {
  const holes = mergeHoles(merge, row, local.holes, ai.holes);
  const [out, back, total] = TOTALS.map((t) => pick(merge, `${row}:${t}`, local[t], ai[t]));
  return { holes, out, in: back, total };
}

/** Ligne vue par l'IA seule : ajoutée entière, toutes ses cases marquées. */
function extraRow(merge: Merge, row: string, ai: DraftPlayerRow): DraftPlayerRow {
  merge.aiCells.push(...ai.scores.holes.map((_, hole) => holeKey(row, hole)));
  merge.aiCells.push(...TOTALS.map((t) => `${row}:${t}`));
  return { name: ai.name, scores: { ...ai.scores, holes: [...ai.scores.holes] } };
}

/**
 * Fusionne la lecture locale et celle de l'IA (design, décision 4). Seules les cases d'un
 * `Problem` de `checkDraft` reprennent la valeur de l'IA, quand elle n'est pas nulle et diffère
 * de la locale ; les lignes de joueur sont alignées par rang, et celles que l'IA voit en plus
 * sont ajoutées.
 */
export function mergeDraft(local: ScorecardDraft, ai: AiCard, problems: Problem[]): MergedDraft {
  const merge: Merge = { eligible: new Set(problems.flatMap(({ cells }) => cells)), aiCells: [] };
  const draft: ScorecardDraft = {
    courseName: pick(merge, "courseName", local.courseName, ai.courseName),
    tees: pick(merge, "tees", local.tees, ai.tees),
    playedOn: local.playedOn,
    par: mergeRow(merge, "par", local.par, ai.par),
    strokeIndex: mergeHoles(merge, "strokeIndex", local.strokeIndex, ai.strokeIndex),
    distance: mergeRow(merge, "distance", local.distance, ai.distance),
    players: local.players.map((row, position) => {
      const aiRow = ai.players[position];
      if (!aiRow) return row;
      return { ...row, scores: mergeRow(merge, `player${position}`, row.scores, aiRow.scores) };
    }),
  };
  const extras = ai.players.slice(local.players.length);
  draft.players.push(
    ...extras.map((row, k) => extraRow(merge, `player${local.players.length + k}`, row)),
  );
  return { draft, aiCells: merge.aiCells };
}
