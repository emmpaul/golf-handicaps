/**
 * pnpm ocr:debug <photo> <corners.json>
 *
 * Rectifies the photo, prepares every grid cell and reads it, then writes to a temporary
 * directory: the rectified panel, a contact sheet of the prepared cells with the value read
 * under each one, and the draft JSON. Used to calibrate `src/ocr/layouts/gspro.ts`.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { Corners } from "../src/ocr/corners";
import { detectPlayerRows, type GridCell, gridCells } from "../src/ocr/grid";
import type { GrayImage } from "../src/ocr/image";
import { readScorecard } from "../src/ocr/read-scorecard";
import { createDefaultCellReader } from "../src/ocr/readers";

const TILE_WIDTH = 290;
const TILE_HEIGHT = 200;
const LABEL_HEIGHT = 36;
const COLUMNS = 21;

function toPng(image: GrayImage): Promise<Buffer> {
  return sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 1 },
  })
    .png()
    .toBuffer();
}

function rowKey(cell: GridCell): string {
  return typeof cell.row === "string" ? cell.row : `player${cell.row.player + 1}`;
}

function label(text: string): Buffer {
  return Buffer.from(
    `<svg width="${TILE_WIDTH}" height="${LABEL_HEIGHT}"><rect width="100%" height="100%" fill="#ffe08a"/>` +
      `<text x="8" y="26" font-family="Menlo, monospace" font-size="24" fill="#000">${text}</text></svg>`,
  );
}

async function contactSheet(cells: GridCell[], values: (number | null)[]): Promise<Buffer> {
  const rowKeys = [...new Set(cells.map(rowKey))];
  const columnOf = new Map<GridCell, number>();
  for (const key of rowKeys) {
    cells
      .filter((c) => rowKey(c) === key)
      .forEach((c, i) => {
        columnOf.set(c, i);
      });
  }
  const composites = await Promise.all(
    cells.flatMap((cell, i) => {
      const left = (columnOf.get(cell) ?? 0) * TILE_WIDTH;
      const top = rowKeys.indexOf(rowKey(cell)) * (TILE_HEIGHT + LABEL_HEIGHT);
      return [
        toPng(cell.image).then((input) => ({ input, left, top })),
        Promise.resolve({
          input: label(`${rowKey(cell)} ${String(cell.column)} = ${values[i] ?? "null"}`),
          left,
          top: top + TILE_HEIGHT,
        }),
      ];
    }),
  );
  return sharp({
    create: {
      width: COLUMNS * TILE_WIDTH,
      height: rowKeys.length * (TILE_HEIGHT + LABEL_HEIGHT),
      channels: 3,
      background: "#888888",
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function main(): Promise<void> {
  const [photoPath, cornersPath] = process.argv.slice(2);
  if (!photoPath || !cornersPath) {
    console.error("Usage : pnpm ocr:debug <photo> <corners.json>");
    process.exit(1);
  }
  const corners = JSON.parse(readFileSync(cornersPath, "utf8")) as Corners;
  const reader = createDefaultCellReader();
  const { draft, panel } = await readScorecard(readFileSync(photoPath), corners, reader);
  const cells = gridCells(panel, detectPlayerRows(panel));
  const values = await Promise.all(cells.map((cell) => reader.read(cell.image)));

  const out = mkdtempSync(join(tmpdir(), "ocr-debug-"));
  writeFileSync(join(out, "panel.png"), await toPng(panel));
  writeFileSync(join(out, "cells.png"), await contactSheet(cells, values));
  writeFileSync(join(out, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
  console.info(`Planche et brouillon écrits dans ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
