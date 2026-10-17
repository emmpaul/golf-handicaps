import type { GrayImage } from "./image";

export const BLACK = 0;
export const WHITE = 255;
const SCALE = 3;
const MARGIN = 12;
/** Below this contrast (2nd → 98th percentile) the cell is considered empty. */
const MIN_CONTRAST = 40;
/** Width of the ring sampled to find the background, as a fraction of the cell size. */
const RING = 0.2;

function percentile(sorted: Uint8Array, p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function otsuThreshold(data: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  for (const v of data) histogram[v]++;
  const total = data.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;
    sumBackground += t * histogram[t];
    const meanB = sumBackground / weightBackground;
    const meanF = (sumAll - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Median grey level of the band along the cell edges, around the digit. */
function ringMedian(cell: GrayImage): number {
  const bandX = Math.max(1, Math.round(cell.width * RING));
  const bandY = Math.max(1, Math.round(cell.height * RING));
  const ring: number[] = [];
  for (let y = 0; y < cell.height; y++) {
    for (let x = 0; x < cell.width; x++) {
      const inRing = x < bandX || y < bandY || x >= cell.width - bandX || y >= cell.height - bandY;
      if (inRing) ring.push(cell.data[y * cell.width + x]);
    }
  }
  ring.sort((a, b) => a - b);
  return ring[Math.floor(ring.length / 2)];
}

/** Light background, dark digit: inverts dark squares and red circles. */
function normalisePolarity(cell: GrayImage): Uint8Array {
  const threshold = otsuThreshold(cell.data);
  if (ringMedian(cell) >= threshold) return cell.data;
  return cell.data.map((v) => 255 - v);
}

function binarise(data: Uint8Array): Uint8Array | null {
  const sorted = Uint8Array.from(data).sort();
  const low = percentile(sorted, 0.02);
  const high = percentile(sorted, 0.98);
  if (high - low < MIN_CONTRAST) return null;
  const stretched = data.map((v) => Math.min(255, Math.max(0, ((v - low) * 255) / (high - low))));
  const threshold = otsuThreshold(stretched);
  return stretched.map((v) => (v <= threshold ? BLACK : WHITE));
}

/** Flood-fills to white every black blob touching the cell border (frames, circle edges). */
function clearBorderBlobs(data: Uint8Array, width: number, height: number): void {
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (data[i] !== BLACK) return;
    data[i] = WHITE;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % width;
    const y = (i - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

function upscaleWithMargin(data: Uint8Array, width: number, height: number): GrayImage {
  const outWidth = width * SCALE + 2 * MARGIN;
  const outHeight = height * SCALE + 2 * MARGIN;
  const out = new Uint8Array(outWidth * outHeight).fill(WHITE);
  for (let y = 0; y < height * SCALE; y++) {
    for (let x = 0; x < width * SCALE; x++) {
      out[(y + MARGIN) * outWidth + x + MARGIN] =
        data[Math.floor(y / SCALE) * width + Math.floor(x / SCALE)];
    }
  }
  return { width: outWidth, height: outHeight, data: out };
}

/**
 * Turns a cropped grid cell into a clean black-on-white bitmap: polarity from the ring
 * around the digit, autocontrast, Otsu threshold, border blobs cleared, ×3, white margin.
 * A cell without contrast (empty) comes out all white.
 */
export function prepareCell(cell: GrayImage): GrayImage {
  const binary = binarise(normalisePolarity(cell)) ?? new Uint8Array(cell.data.length).fill(WHITE);
  clearBorderBlobs(binary, cell.width, cell.height);
  return upscaleWithMargin(binary, cell.width, cell.height);
}
