import { cropRelative, type GrayImage } from "./image";
import {
  type Column,
  cellRect,
  type GridRow,
  GSPRO_PLAYER_ROWS,
  playerNameRect,
} from "./layouts/gspro";
import { prepareCell } from "./prepare-cell";

/** Pixels at least this much darker than the box median count as name ink. */
const INK_CONTRAST = 50;
/** A name box with less ink than this ratio is empty (row absent). */
const MIN_INK_RATIO = 0.01;

/**
 * A player row is present when its name box is not flat. The flatness test counts
 * pixels well below the box median rather than the raw variance, so the screen's
 * brightness gradient across an empty row does not count as content.
 */
function hasName(box: GrayImage): boolean {
  const sorted = Uint8Array.from(box.data).sort();
  const median = sorted[sorted.length >> 1];
  const ink = box.data.filter((v) => v < median - INK_CONTRAST).length;
  return ink / box.data.length > MIN_INK_RATIO;
}

export function detectPlayerRows(panel: GrayImage): boolean[] {
  return Array.from({ length: GSPRO_PLAYER_ROWS }, (_, player) =>
    hasName(cropRelative(panel, playerNameRect(player))),
  );
}

export type GridCell = { row: GridRow; column: Column; image: GrayImage };

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);
const WITH_TOTALS: Column[] = [...HOLES.slice(0, 9), "out", ...HOLES.slice(9), "in", "total"];

/** Every numeric cell to read, prepared for OCR, for the PAR/INDEX/DISTANCE rows and present players. */
export function gridCells(panel: GrayImage, presentPlayers: readonly boolean[]): GridCell[] {
  const rows: [GridRow, Column[]][] = [
    ["par", WITH_TOTALS],
    ["strokeIndex", HOLES],
    ["distance", WITH_TOTALS],
    ...presentPlayers.flatMap((present, player): [GridRow, Column[]][] =>
      present ? [[{ player }, WITH_TOTALS]] : [],
    ),
  ];
  return rows.flatMap(([row, columns]) =>
    columns.map((column) => ({
      row,
      column,
      image: prepareCell(cropRelative(panel, cellRect(row, column))),
    })),
  );
}
