import { describe, expect, it } from "vitest";
import { applyHomography, computeHomography, type Point } from "@/ocr/homography";

const UNIT_SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

// Projective map (x, y) → (300·x/(x+1), 300·y/(x+1)), worked out by hand.
// A bilinear interpolation would send (0.5, 0.5) to (75, 112.5) instead of (100, 100).
const PROJECTIVE_QUAD: Point[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 150, y: 150 },
  { x: 0, y: 300 },
];

const SCALED_RECT: Point[] = [
  { x: 10, y: 20 },
  { x: 210, y: 20 },
  { x: 210, y: 120 },
  { x: 10, y: 120 },
];

describe("computeHomography", () => {
  it.each([
    ["projective", PROJECTIVE_QUAD, { x: 0.5, y: 0.5 }, { x: 100, y: 100 }],
    ["projective", PROJECTIVE_QUAD, { x: 0.25, y: 0.75 }, { x: 60, y: 180 }],
    ["projective", PROJECTIVE_QUAD, { x: 0.5, y: 0 }, { x: 100, y: 0 }],
    ["projective", PROJECTIVE_QUAD, { x: 1, y: 1 }, { x: 150, y: 150 }],
    ["échelle", SCALED_RECT, { x: 0.5, y: 0.25 }, { x: 110, y: 45 }],
  ])("quadrilatère %s : envoie %o sur %o à 0,5 px près", (_name, quad, source, expected) => {
    const mapped = applyHomography(computeHomography(UNIT_SQUARE, quad), source);
    expect(Math.abs(mapped.x - expected.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(mapped.y - expected.y)).toBeLessThanOrEqual(0.5);
  });
});
