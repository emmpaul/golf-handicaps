import { MAX_PLAYERS, type RoundForm, type RoundFormRow } from "@/scorecard/checks";
import type { DraftHoleRow, DraftValue } from "@/scorecard/draft";
import type { SavedCorrection } from "@/scorecard/form-schema";

export const HOLES = 18;
export const MAX_LINES = MAX_PLAYERS;

/** Parcours connu (nom, tees) et ses valeurs de référence (spec `rounds`). */
export type KnownCourse = {
  courseName: string;
  tees: string;
  pars: number[];
  strokeIndexes: number[];
  distances: (number | null)[];
};

export type PlayerOption = { id: number; name: string };

/**
 * Ligne de joueur de l'éditeur. `readTotals` : les totaux OUT, IN et TOT sont ceux lus sur
 * la carte, à vérifier. Sinon (ligne saisie à la main), ils suivent les cases.
 */
export type EditorLine = RoundFormRow & { key: number; readTotals: boolean };

export type EditorState = {
  form: Omit<RoundForm, "players">;
  /** Les totaux de PAR et DISTANCE viennent de la lecture de la carte. */
  readCardTotals: boolean;
  lines: EditorLine[];
  /** Clés de case remplies par l'IA et pas encore modifiées (spec `scorecard-ai-completion`). */
  aiCells: string[];
};

const emptyValues = (): DraftValue[] => Array(HOLES).fill(null);

const sumOf = (values: readonly DraftValue[]) =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);

/** Totaux d'une ligne saisie à la main : sommes des cases remplies. */
export function derivedTotals(holes: readonly DraftValue[]): DraftHoleRow {
  const out = sumOf(holes.slice(0, 9));
  const back = sumOf(holes.slice(9));
  return { holes: [...holes], out, in: back, total: out + back };
}

const withRowTotals = (row: DraftHoleRow, read: boolean) => (read ? row : derivedTotals(row.holes));

/** Formulaire envoyé et contrôlé : totaux recalculés pour les lignes saisies à la main. */
export function toRoundForm(state: EditorState): RoundForm {
  return {
    ...state.form,
    par: withRowTotals(state.form.par, state.readCardTotals),
    distance: withRowTotals(state.form.distance, state.readCardTotals),
    players: state.lines.map(({ name, playerId, scores, readTotals }) => ({
      name,
      playerId,
      scores: withRowTotals(scores, readTotals),
    })),
  };
}

let nextKey = 1;

export function newLine(row: Partial<RoundFormRow> = {}, readTotals = false): EditorLine {
  return {
    key: nextKey++,
    name: row.name ?? null,
    playerId: row.playerId ?? null,
    scores: row.scores ?? derivedTotals(emptyValues()),
    readTotals,
  };
}

/** Écran vide (saisie manuelle, ou lecture impossible) : une ligne de joueur à remplir. */
export function emptyEditorState(playedOn: string): EditorState {
  return {
    form: {
      courseName: null,
      tees: null,
      playedOn,
      par: derivedTotals(emptyValues()),
      strokeIndex: emptyValues(),
      distance: derivedTotals(emptyValues()),
    },
    readCardTotals: false,
    lines: [newLine()],
    aiCells: [],
  };
}

/**
 * Écran pré-rempli par la lecture d'une carte : totaux lus, à vérifier. `aiCells` : cases
 * complétées par l'IA, marquées dans l'écran.
 */
export function readEditorState(
  form: RoundForm,
  readTotals: boolean,
  aiCells: readonly string[] = [],
): EditorState {
  const { players, ...card } = form;
  return {
    form: card,
    readCardTotals: readTotals,
    lines: players.map((row) => newLine(row, readTotals)),
    aiCells: [...aiCells],
  };
}

/** État de l'éditeur vers sa forme enregistrée : tout sauf la `key` des lignes, locale à l'onglet. */
export function toSavedCorrection(state: EditorState): SavedCorrection {
  return {
    version: 1,
    card: state.form,
    readCardTotals: state.readCardTotals,
    lines: state.lines.map(({ name, playerId, scores, readTotals }) => ({
      name,
      playerId,
      scores,
      readTotals,
    })),
    aiCells: state.aiCells,
  };
}

/**
 * Reprise d'une correction enregistrée : totaux gardés tels quels, nouvelles `key`. Un joueur
 * absent de `players` redevient `null`, pour ne pas envoyer une clé étrangère invalide.
 */
export function restoreEditorState(
  saved: SavedCorrection,
  players: readonly PlayerOption[],
): EditorState {
  const known = (id: number | null) => players.some((player) => player.id === id);
  return {
    form: saved.card,
    readCardTotals: saved.readCardTotals,
    lines: saved.lines.map(({ readTotals, ...row }) =>
      newLine({ ...row, playerId: known(row.playerId) ? row.playerId : null }, readTotals),
    ),
    aiCells: [...saved.aiCells],
  };
}

/** Une case modifiée à la main n'est plus marquée comme complétée par l'IA. */
export function withoutAiCell(state: EditorState, cell: string): EditorState {
  return { ...state, aiCells: state.aiCells.filter((key) => key !== cell) };
}

/**
 * Retire une ligne de joueur. Ses marques IA partent avec elle, et celles des lignes
 * suivantes suivent leur nouveau rang (les clés de case `player<n>` sont positionnelles).
 */
export function removeLine(state: EditorState, key: number): EditorState {
  const removed = state.lines.findIndex((line) => line.key === key);
  const aiCells = state.aiCells.flatMap((cell) => {
    const match = /^player(\d+):(.+)$/.exec(cell);
    if (!match || removed < 0) return [cell];
    const position = Number(match[1]);
    if (position === removed) return [];
    return [position > removed ? `player${position - 1}:${match[2]}` : cell];
  });
  return { ...state, lines: state.lines.filter((line) => line.key !== key), aiCells };
}

/** Pré-remplit pars, index et distances depuis un parcours connu. */
export function applyCourse(state: EditorState, course: KnownCourse): EditorState {
  return {
    ...state,
    readCardTotals: false,
    form: {
      ...state.form,
      courseName: course.courseName,
      tees: course.tees,
      par: derivedTotals(course.pars),
      strokeIndex: [...course.strokeIndexes],
      distance: derivedTotals(course.distances),
    },
  };
}

/** Texte d'une case vers sa valeur : un entier positif, sinon case vide. */
export function parseCell(text: string): DraftValue {
  const trimmed = text.trim();
  return /^\d{1,5}$/.test(trimmed) ? Number(trimmed) : null;
}

/** Date du jour au format ISO, proposée quand la carte n'en montre pas. */
export function todayIso(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const courseLabel = ({ courseName, tees }: { courseName: string; tees: string }) =>
  `${courseName} / ${tees}`;

/**
 * Libellé d'une ligne de joueur dans la grille : le joueur associé, sinon le nom lu suivi
 * de « ? », sinon « Ligne n » (`position` part de 0).
 */
export function lineLabel(
  line: Pick<EditorLine, "name" | "playerId">,
  position: number,
  players: readonly PlayerOption[],
): string {
  const player = players.find(({ id }) => id === line.playerId);
  if (player) return player.name;
  if (line.name) return `${line.name} ?`;
  return `Ligne ${position + 1}`;
}
