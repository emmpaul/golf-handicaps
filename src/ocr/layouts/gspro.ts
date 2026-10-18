/**
 * GSPro end-of-round scorecard layout, in coordinates relative to the rectified panel
 * (0–1 on each axis). Calibrated on IMG_3064 with `pnpm ocr:debug`: values are written
 * as pixels measured on the 2400×1224 rectified panel, divided by that size.
 */
const W = 2400;
const H = 1224;

/** Size of the rectified panel, close to the panel's on-screen aspect ratio. */
export const GSPRO_PANEL = { width: W, height: H } as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** Grid columns, left to right: holes 1–9, OUT, holes 10–18, IN, TOT. */
export type Column = number | "out" | "in" | "total";

/** Measured centre of each column (ink centroid of PAR and DISTANCE), left to right. */
const COLUMN_X = [
  463, 556, 650, 743, 836, 928, 1019, 1110, 1201, 1292, 1383, 1474, 1567, 1661, 1753, 1847, 1939,
  2029, 2120, 2210, 2299,
] as const;

/** 0-based position of a column on the grid. */
function columnPosition(column: Column): number {
  if (column === "out") return 9;
  if (column === "in") return 19;
  if (column === "total") return 20;
  return column <= 9 ? column - 1 : column;
}

const ROW_Y = {
  par: 259,
  strokeIndex: 335,
  distance: 414,
  players: [493, 573, 653, 733],
} as const;

export type GridRow = "par" | "strokeIndex" | "distance" | { player: number };

function rowY(row: GridRow): number {
  return typeof row === "string" ? ROW_Y[row] : ROW_Y.players[row.player];
}

function centered(cx: number, cy: number, width: number, height: number): Rect {
  return {
    x: (cx - width / 2) / W,
    y: (cy - height / 2) / H,
    width: width / W,
    height: height / H,
  };
}

/**
 * Printed numbers (PAR, INDEX, DISTANCE, totals) get a wide box: up to 4 digits.
 * Player hole scores get a box that sits inside the score marker (dark square ~58 px,
 * outlined square ~49 px, red circle ~59 px), so the marker edge is cut by the box border
 * and cleared as a border-connected blob.
 */
const PRINTED_CELL = { width: 84, height: 44 };
const SCORE_CELL = { width: 44, height: 44 };

export function cellRect(row: GridRow, column: Column): Rect {
  const isScore = typeof row !== "string" && typeof column === "number";
  const size = isScore ? SCORE_CELL : PRINTED_CELL;
  return centered(COLUMN_X[columnPosition(column)], rowY(row), size.width, size.height);
}

/** Player name box, left of the grid (after the avatar icon). */
export function playerNameRect(player: number): Rect {
  return { x: 70 / W, y: (ROW_Y.players[player] - 24) / H, width: 250 / W, height: 48 / H };
}

/** Maximum number of player rows on a GSPro card. */
export const GSPRO_PLAYER_ROWS = ROW_Y.players.length;

/** Course name, white on the dark header band (first line only). */
export const COURSE_NAME_ZONE: Rect = { x: 60 / W, y: 26 / H, width: 600 / W, height: 58 / H };

/**
 * The light table, from under the dark HOLE row down to the dark ROUND SETTINGS band, across
 * the whole panel width. Panel detection finds this rectangle on the photo and maps it back
 * to the panel corners.
 */
export const TABLE_RECT: Rect = { x: 0, y: 220 / H, width: 1, height: 845 / H };

/**
 * The two ROUND SETTINGS text lines (game type, tees… / greens, date…), dark on light.
 * Read one line at a time: on the whole band Tesseract drops the second line.
 */
export const SETTINGS_LINES: readonly Rect[] = [
  { x: 0, y: 1128 / H, width: 1, height: 44 / H },
  { x: 0, y: 1172 / H, width: 1, height: 44 / H },
];
