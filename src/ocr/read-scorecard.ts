import type { DraftHoleRow, DraftValue, ScorecardDraft } from "@/scorecard/draft";
import type { CellReader } from "./cell-reader";
import type { Corners } from "./corners";
import { detectPlayerRows, type GridCell, gridCells } from "./grid";
import { cropRelative, type GrayImage } from "./image";
import {
  COURSE_NAME_ZONE,
  type Column,
  type GridRow,
  playerNameRect,
  type Rect,
  SETTINGS_LINES,
} from "./layouts/gspro";
import { prepareCell } from "./prepare-cell";
import { createDefaultCellReader } from "./readers";
import { rectifyPanel } from "./rectify";
import { parsePlayedOn, parseTees } from "./settings-text";
import { runTesseract, type TesseractOptions } from "./tesseract";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function readZone(panel: GrayImage, zone: Rect, options: TesseractOptions): Promise<string> {
  return runTesseract(prepareCell(cropRelative(panel, zone)), options);
}

/** First non-empty line of the header: the course name. */
async function readCourseName(panel: GrayImage): Promise<string | null> {
  const text = await readZone(panel, COURSE_NAME_ZONE, { psm: 6 });
  const line = text.split("\n").find((l) => l.trim() !== "");
  return line ? line.trim().replace(/\s+/g, " ") : null;
}

async function readPlayerName(panel: GrayImage, player: number): Promise<string | null> {
  const text = await readZone(panel, playerNameRect(player), { psm: 7, whitelist: LETTERS });
  const name = text.replace(/[^A-Z]/g, "");
  return name === "" ? null : name;
}

type ValueAt = (row: GridRow, column: Column) => DraftValue;

function sameRow(a: GridRow, b: GridRow): boolean {
  return typeof a === "string" || typeof b === "string" ? a === b : a.player === b.player;
}

const HOLES = Array.from({ length: 18 }, (_, i) => i + 1);

function holeRow(valueAt: ValueAt, row: GridRow): DraftHoleRow {
  return {
    holes: HOLES.map((hole) => valueAt(row, hole)),
    out: valueAt(row, "out"),
    in: valueAt(row, "in"),
    total: valueAt(row, "total"),
  };
}

/** Reads every cell and text zone of a rectified GSPro panel into a draft. */
export async function readScorecardPanel(
  panel: GrayImage,
  reader: CellReader,
): Promise<ScorecardDraft> {
  const present = detectPlayerRows(panel);
  const cells: GridCell[] = gridCells(panel, present);
  const players = present.flatMap((isPresent, player) => (isPresent ? [player] : []));
  const [values, courseName, settings, names] = await Promise.all([
    Promise.all(cells.map((cell) => reader.read(cell.image))),
    readCourseName(panel),
    Promise.all(SETTINGS_LINES.map((line) => readZone(panel, line, { psm: 6 }))).then((lines) =>
      lines.join("\n"),
    ),
    Promise.all(players.map((player) => readPlayerName(panel, player))),
  ]);
  const valueAt: ValueAt = (row, column) => {
    const index = cells.findIndex((c) => sameRow(c.row, row) && c.column === column);
    return index < 0 ? null : values[index];
  };
  return {
    courseName,
    tees: parseTees(settings),
    playedOn: parsePlayedOn(settings),
    par: holeRow(valueAt, "par"),
    strokeIndex: HOLES.map((hole) => valueAt("strokeIndex", hole)),
    distance: holeRow(valueAt, "distance"),
    players: players.map((player, i) => ({
      name: names[i],
      scores: holeRow(valueAt, { player }),
    })),
  };
}

/** A draft and the rectified panel it was read from (sent to the AI fallback as is). */
export type ScorecardReading = { draft: ScorecardDraft; panel: GrayImage };

/** Full OCR of a scorecard photo, given the 4 panel corners (normalised 0–1). */
export async function readScorecard(
  photo: Buffer,
  corners: Corners,
  reader: CellReader = createDefaultCellReader(),
): Promise<ScorecardReading> {
  const panel = await rectifyPanel(photo, corners);
  return { draft: await readScorecardPanel(panel, reader), panel };
}
