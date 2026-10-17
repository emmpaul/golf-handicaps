/**
 * pnpm ocr:templates
 *
 * Builds the digit templates 0–9 of `TemplateCellReader` from the reference card IMG_3064:
 * every grid cell whose hand-written value (tests/fixtures/scorecards/gspro-img3064.draft.json)
 * splits into as many glyphs as it has digits contributes one sample per digit. Samples are
 * averaged and thresholded at 50 %, then written to src/ocr/templates/gspro-digits.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { GLYPH_HEIGHT, GLYPH_WIDTH, segmentGlyphs } from "../src/ocr/glyphs";
import { detectPlayerRows, type GridCell, gridCells } from "../src/ocr/grid";
import type { Column, GridRow } from "../src/ocr/layouts/gspro";
import { rectifyPanel } from "../src/ocr/rectify";
import type { DraftHoleRow, ScorecardDraft } from "../src/scorecard/draft";

const FIXTURES = resolve(__dirname, "../tests/fixtures/scorecards");
const OUTPUT = resolve(__dirname, "../src/ocr/templates/gspro-digits.json");

function fromHoleRow(row: DraftHoleRow, column: Column): number | null {
  if (column === "out") return row.out;
  if (column === "in") return row.in;
  if (column === "total") return row.total;
  return row.holes[column - 1];
}

function expectedValue(draft: ScorecardDraft, row: GridRow, column: Column): number | null {
  if (row === "strokeIndex")
    return typeof column === "number" ? draft.strokeIndex[column - 1] : null;
  if (row === "par" || row === "distance") return fromHoleRow(draft[row], column);
  return fromHoleRow(draft.players[row.player].scores, column);
}

async function main(): Promise<void> {
  const photo = readFileSync(resolve(FIXTURES, "gspro-img3064.jpg"));
  const corners = JSON.parse(readFileSync(resolve(FIXTURES, "gspro-img3064.corners.json"), "utf8"));
  const draft = JSON.parse(
    readFileSync(resolve(FIXTURES, "gspro-img3064.draft.json"), "utf8"),
  ) as ScorecardDraft;
  const panel = await rectifyPanel(photo, corners);
  const size = GLYPH_WIDTH * GLYPH_HEIGHT;
  const sums = Array.from({ length: 10 }, () => new Float64Array(size));
  const counts = new Array<number>(10).fill(0);
  const skipped: GridCell[] = [];

  for (const cell of gridCells(panel, detectPlayerRows(panel))) {
    const value = expectedValue(draft, cell.row, cell.column);
    if (value === null) continue;
    const digits = String(value).split("").map(Number);
    const glyphs = segmentGlyphs(cell.image);
    if (glyphs.length !== digits.length) {
      skipped.push(cell);
      continue;
    }
    glyphs.forEach((glyph, i) => {
      counts[digits[i]]++;
      glyph.forEach((v, p) => {
        sums[digits[i]][p] += v;
      });
    });
  }

  const digits: Record<string, string[]> = {};
  sums.forEach((sum, digit) => {
    if (counts[digit] === 0) throw new Error(`Aucun exemple du chiffre ${digit}`);
    digits[digit] = Array.from({ length: GLYPH_HEIGHT }, (_, y) =>
      Array.from({ length: GLYPH_WIDTH }, (_, x) =>
        sum[y * GLYPH_WIDTH + x] / counts[digit] >= 0.5 ? "#" : ".",
      ).join(""),
    );
  });
  writeFileSync(
    OUTPUT,
    `${JSON.stringify({ width: GLYPH_WIDTH, height: GLYPH_HEIGHT, digits }, null, 2)}\n`,
  );
  console.info(`Modèles écrits dans ${OUTPUT}`);
  console.info(`Exemples par chiffre : ${counts.join(", ")}`);
  if (skipped.length > 0) {
    console.warn(
      `${skipped.length} case(s) ignorée(s), nombre de glyphes différent du nombre de chiffres :`,
    );
    for (const cell of skipped) console.warn(`  - ${JSON.stringify(cell.row)} ${cell.column}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
