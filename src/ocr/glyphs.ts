import type { GrayImage } from "./image";
import { BLACK } from "./prepare-cell";

/** Normalised glyph grid used by the digit templates. */
export const GLYPH_WIDTH = 16;
export const GLYPH_HEIGHT = 24;

/** Blobs smaller than this (in prepared, ×3 pixels) are specks, dropped before merging. */
const MIN_SPECK_AREA = 30;
/** Merged blobs smaller than this are not digits. */
const MIN_GLYPH_AREA = 60;
/** Blobs lower than this fraction of the tallest blob are specks or punctuation. */
const MIN_RELATIVE_HEIGHT = 0.5;

type Box = { x0: number; y0: number; x1: number; y1: number; area: number; pixels: number[] };

function emptyBox(width: number, height: number): Box {
  return { x0: width, y0: height, x1: -1, y1: -1, area: 0, pixels: [] };
}

function addPixel(box: Box, i: number, x: number, y: number): void {
  box.pixels.push(i);
  box.area++;
  box.x0 = Math.min(box.x0, x);
  box.y0 = Math.min(box.y0, y);
  box.x1 = Math.max(box.x1, x);
  box.y1 = Math.max(box.y1, y);
}

/** Indexes of the 8 neighbours of (x, y) inside the image. */
function neighbours(x: number, y: number, width: number, height: number): number[] {
  const result: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx !== 0 || dy !== 0) && nx >= 0 && ny >= 0 && nx < width && ny < height) {
        result.push(ny * width + nx);
      }
    }
  }
  return result;
}

/** 8-connected black components of a prepared cell. */
function components(image: GrayImage): Box[] {
  const { width, height, data } = image;
  const seen = new Uint8Array(data.length);
  const boxes: Box[] = [];
  for (let start = 0; start < data.length; start++) {
    if (data[start] !== BLACK || seen[start]) continue;
    const box = emptyBox(width, height);
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      const x = i % width;
      const y = (i - x) / width;
      addPixel(box, i, x, y);
      for (const j of neighbours(x, y, width, height)) {
        if (data[j] === BLACK && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    boxes.push(box);
  }
  return boxes;
}

/**
 * Scales a glyph into the 16×24 grid, keeping its aspect ratio (a "1" stays narrow),
 * centred. Each grid cell is 1 when at least half of its source area is ink.
 */
function normalise(box: Box, imageWidth: number): Uint8Array {
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const scale = Math.min(GLYPH_WIDTH / w, GLYPH_HEIGHT / h);
  const offsetX = (GLYPH_WIDTH - w * scale) / 2;
  const offsetY = (GLYPH_HEIGHT - h * scale) / 2;
  const ink = new Float64Array(GLYPH_WIDTH * GLYPH_HEIGHT);
  const area = new Float64Array(GLYPH_WIDTH * GLYPH_HEIGHT);
  const inBox = new Set(box.pixels);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.min(GLYPH_WIDTH - 1, Math.floor(offsetX + (x + 0.5) * scale));
      const gy = Math.min(GLYPH_HEIGHT - 1, Math.floor(offsetY + (y + 0.5) * scale));
      const g = gy * GLYPH_WIDTH + gx;
      area[g]++;
      if (inBox.has((box.y0 + y) * imageWidth + box.x0 + x)) ink[g]++;
    }
  }
  return Uint8Array.from(ink, (v, g) => (area[g] > 0 && v / area[g] >= 0.5 ? 1 : 0));
}

/** Horizontal overlap, as a fraction of the narrower box, above which two blobs are one glyph. */
const MERGE_OVERLAP = 0.5;

function overlapRatio(a: Box, b: Box): number {
  const overlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
  return overlap / Math.min(a.x1 - a.x0 + 1, b.x1 - b.x0 + 1);
}

/** Thin joints can break after thresholding (the top bar of a "5"): stacked blobs are one glyph. */
function mergeStacked(blobs: Box[]): Box[] {
  const merged: Box[] = [];
  for (const blob of [...blobs].sort((a, b) => a.x0 - b.x0)) {
    const target = merged.find((m) => overlapRatio(m, blob) >= MERGE_OVERLAP);
    if (!target) {
      merged.push({ ...blob, pixels: [...blob.pixels] });
      continue;
    }
    target.x0 = Math.min(target.x0, blob.x0);
    target.y0 = Math.min(target.y0, blob.y0);
    target.x1 = Math.max(target.x1, blob.x1);
    target.y1 = Math.max(target.y1, blob.y1);
    target.area += blob.area;
    target.pixels.push(...blob.pixels);
  }
  return merged;
}

/** Digit glyphs of a prepared cell, left to right, each as a 16×24 bitmap (1 = ink). */
export function segmentGlyphs(image: GrayImage): Uint8Array[] {
  const blobs = mergeStacked(components(image).filter((b) => b.area >= MIN_SPECK_AREA)).filter(
    (b) => b.area >= MIN_GLYPH_AREA,
  );
  const tallest = Math.max(0, ...blobs.map((b) => b.y1 - b.y0 + 1));
  return blobs
    .filter((b) => b.y1 - b.y0 + 1 >= tallest * MIN_RELATIVE_HEIGHT)
    .sort((a, b) => a.x0 - b.x0)
    .map((b) => normalise(b, image.width));
}

export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  let distance = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) distance++;
  return distance;
}
