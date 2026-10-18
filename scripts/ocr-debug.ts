/**
 * pnpm ocr:debug <photo> [corners.json]
 *
 * Rectifies the photo, prepares every grid cell and reads it, then writes to a temporary
 * directory: the rectified panel, a contact sheet of the prepared cells with the value read
 * under each one, the draft JSON, the reduced photo with the panel quadrilateral (and, when
 * detected, the table one) drawn on it, and the values of the panel check. Without a corners
 * file, the corners come from the local panel detection. Used to calibrate
 * `src/ocr/layouts/gspro.ts` and the thresholds of `src/ocr/detect-panel.ts`.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { Corners } from "../src/ocr/corners";
import { detectPanel, measurePanel } from "../src/ocr/detect-panel";
import { detectPlayerRows, type GridCell, gridCells } from "../src/ocr/grid";
import type { GrayImage } from "../src/ocr/image";
import { readScorecardPanel } from "../src/ocr/read-scorecard";
import { createDefaultCellReader } from "../src/ocr/readers";
import { rectifyPanel } from "../src/ocr/rectify";

const TILE_WIDTH = 290;
const TILE_HEIGHT = 200;
const LABEL_HEIGHT = 36;
const COLUMNS = 21;
/** Long side of the reduced photo the quadrilaterals are drawn on. */
const OVERLAY_SIZE = 1000;

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

function polygon(quad: Corners, width: number, height: number, colour: string): string {
  const points = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]
    .map((p) => `${(p.x * width).toFixed(1)},${(p.y * height).toFixed(1)}`)
    .join(" ");
  return `<polygon points="${points}" fill="none" stroke="${colour}" stroke-width="3"/>`;
}

/** The reduced photo with the panel quadrilateral in red and the table one in blue. */
async function overlay(photo: Buffer, corners: Corners, table: Corners | null): Promise<Buffer> {
  const reduced = await sharp(photo)
    .rotate()
    .resize(OVERLAY_SIZE, OVERLAY_SIZE, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = reduced.info;
  const svg =
    `<svg width="${width}" height="${height}">` +
    (table ? polygon(table, width, height, "#2f7bff") : "") +
    polygon(corners, width, height, "#ff3030") +
    "</svg>";
  return sharp(reduced.data)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

type Framing = { corners: Corners; panel: GrayImage; table: Corners | null };

/** Corners from the file when given, else from the local detection (`null` if none found). */
async function framing(photo: Buffer, cornersPath: string | undefined): Promise<Framing | null> {
  if (!cornersPath) return detectPanel(photo);
  const corners = JSON.parse(readFileSync(cornersPath, "utf8")) as Corners;
  return { corners, panel: await rectifyPanel(photo, corners), table: null };
}

async function main(): Promise<void> {
  const [photoPath, cornersPath] = process.argv.slice(2);
  if (!photoPath) {
    console.error("Usage : pnpm ocr:debug <photo> [corners.json]");
    process.exit(1);
  }
  const photo = readFileSync(photoPath);
  const found = await framing(photo, cornersPath);
  if (!found) {
    console.error("Panneau introuvable sur la photo");
    process.exit(1);
  }
  const { corners, panel, table } = found;
  const reader = createDefaultCellReader();
  const draft = await readScorecardPanel(panel, reader);
  const cells = gridCells(panel, detectPlayerRows(panel));
  const values = await Promise.all(cells.map((cell) => reader.read(cell.image)));
  const checks = measurePanel(panel);

  const out = mkdtempSync(join(tmpdir(), "ocr-debug-"));
  writeFileSync(join(out, "panel.png"), await toPng(panel));
  writeFileSync(join(out, "cells.png"), await contactSheet(cells, values));
  writeFileSync(join(out, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
  writeFileSync(join(out, "framing.png"), await overlay(photo, corners, table));
  writeFileSync(
    join(out, "framing.json"),
    `${JSON.stringify({ source: cornersPath ? "file" : "detection", corners, table, checks }, null, 2)}\n`,
  );
  console.info(`Contrôles du panneau : ${JSON.stringify(checks)}`);
  console.info(`Planche, brouillon et cadrage écrits dans ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
