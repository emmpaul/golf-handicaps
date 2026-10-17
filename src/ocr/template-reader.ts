import type { CellReader } from "./cell-reader";
import { hammingDistance, segmentGlyphs } from "./glyphs";
import type { GrayImage } from "./image";
import gsproDigits from "./templates/gspro-digits.json";

/**
 * Above this many differing pixels (25 % of the 16×24 = 384 grid) a glyph is not trusted.
 * On the reference card the worst correct match is 81 (bold white-on-dark "5").
 */
export const MAX_TEMPLATE_DISTANCE = 96;

const TEMPLATES = Object.entries(gsproDigits.digits).map(([digit, rows]) => ({
  digit: Number(digit),
  bitmap: Uint8Array.from(rows.join(""), (c) => (c === "#" ? 1 : 0)),
}));

function bestDigit(glyph: Uint8Array): { digit: number; distance: number } {
  let best = { digit: -1, distance: Number.POSITIVE_INFINITY };
  for (const template of TEMPLATES) {
    const distance = hammingDistance(glyph, template.bitmap);
    if (distance < best.distance) best = { digit: template.digit, distance };
  }
  return best;
}

/**
 * Reads the simulator's fixed font by matching each glyph against digit templates 0–9
 * extracted from the reference card. Falls back to `fallback` when a glyph matches no
 * template closely enough.
 */
export function createTemplateCellReader(fallback: CellReader): CellReader {
  return {
    async read(cell: GrayImage) {
      const glyphs = segmentGlyphs(cell);
      if (glyphs.length === 0) return null;
      const matches = glyphs.map(bestDigit);
      if (matches.some((m) => m.distance > MAX_TEMPLATE_DISTANCE)) return fallback.read(cell);
      return Number(matches.map((m) => m.digit).join(""));
    },
  };
}
