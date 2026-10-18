import sharp from "sharp";
import type { Corners } from "./corners";
import { detectPlayerRows } from "./grid";
import { applyHomography, computeHomography, type Point } from "./homography";
import { cropRelative, type GrayImage } from "./image";
import { COURSE_NAME_ZONE, GSPRO_PANEL, type Rect, TABLE_RECT } from "./layouts/gspro";
import { decodeGray, rectifyGray } from "./rectify";

/** A straight line a·x + b·y = c. */
export type Line = { a: number; b: number; c: number };

/** y = slope·x + intercept. */
export type EdgeFit = { slope: number; intercept: number };

/**
 * Share of the edge points, the furthest from the current fit, dropped before refitting, and
 * how many times. Calibrated on the fixtures: a simulator overlay can hide a fifth of a side
 * in one block (Calanova), which a single 10 % pass does not remove.
 */
const OUTLIER_SHARE = 0.3;
const TRIM_PASSES = 3;

function leastSquares(points: readonly Point[]): EdgeFit {
  const n = points.length;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/**
 * Least-squares line through edge points, refitted without the points furthest from the
 * previous fit (rounded corners, glare, an overlay on the table border), a few times over.
 */
export function fitEdge(points: readonly Point[]): EdgeFit {
  const keep = points.length - Math.floor(points.length * OUTLIER_SHARE);
  let fit = leastSquares(points);
  const residuals = new Float64Array(points.length);
  for (let pass = 0; pass < TRIM_PASSES; pass++) {
    const { slope, intercept } = fit;
    points.forEach((p, i) => {
      residuals[i] = Math.abs(p.y - (slope * p.x + intercept));
    });
    // Sorting indices by precomputed residuals compares the same values as sorting the points.
    const order = Array.from(points.keys()).sort((i, j) => residuals[i] - residuals[j]);
    fit = leastSquares(order.slice(0, keep).map((i) => points[i]));
  }
  return fit;
}

export function intersect(l1: Line, l2: Line): Point {
  const det = l1.a * l2.b - l2.a * l1.b;
  return {
    x: (l1.c * l2.b - l2.c * l1.b) / det,
    y: (l1.a * l2.c - l2.a * l1.c) / det,
  };
}

/** A panel smaller than this share of the photo is not a card shot (design §3). */
const MIN_PANEL_AREA = 1 / 5;
/** The header band is dark: its median grey must not be above this. */
const MAX_HEADER_MEDIAN = 90;
/** The table is light: its median grey must not be below this. */
const MIN_TABLE_MEDIAN = 150;

/** The header band: the course name zone, widened to the whole panel width. */
const HEADER_ZONE: Rect = {
  x: 0,
  y: COURSE_NAME_ZONE.y,
  width: 1,
  height: COURSE_NAME_ZONE.height,
};

function cornerList(corners: Corners): Point[] {
  return [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
}

/**
 * Inside the photo, convex, clockwise (y down) from the top left, and at least a fifth of the
 * photo. A clockwise check also refuses corners given in the wrong order.
 */
function isPlausibleQuad(corners: Corners): boolean {
  const points = cornerList(corners);
  if (points.some((p) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false;
  const turns = points.map((p, i) => {
    const q = points[(i + 1) % 4];
    const r = points[(i + 2) % 4];
    return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
  });
  if (turns.some((turn) => turn <= 0)) return false;
  const area = points.reduce((sum, p, i) => {
    const q = points[(i + 1) % 4];
    return sum + (p.x * q.y - q.x * p.y) / 2;
  }, 0);
  return area >= MIN_PANEL_AREA;
}

/** The middle grey of the sorted pixels (`sorted[length >> 1]`), read off a histogram. */
function median(image: GrayImage): number {
  const histogram = new Uint32Array(256);
  for (const v of image.data) histogram[v]++;
  const rank = image.data.length >> 1;
  let count = 0;
  for (let v = 0; v < 256; v++) {
    count += histogram[v];
    if (count > rank) return v;
  }
  return Number.NaN;
}

/** The values the panel check of design §3 looks at, on a rectified panel. */
export type PanelChecks = { headerMedian: number; tableMedian: number; playerRows: boolean[] };

export function measurePanel(panel: GrayImage): PanelChecks {
  return {
    headerMedian: median(cropRelative(panel, HEADER_ZONE)),
    tableMedian: median(cropRelative(panel, TABLE_RECT)),
    playerRows: detectPlayerRows(panel),
  };
}

/** The rectified panel when it looks like a GSPro card (design §3), else `null`. */
function acceptOnGray(source: GrayImage, corners: Corners): GrayImage | null {
  if (!isPlausibleQuad(corners)) return null;
  const panel = rectifyGray(source, corners);
  const checks = measurePanel(panel);
  if (checks.headerMedian > MAX_HEADER_MEDIAN) return null;
  if (checks.tableMedian < MIN_TABLE_MEDIAN) return null;
  if (!checks.playerRows.some(Boolean)) return null;
  return panel;
}

/**
 * Checks corners found on the photo, locally or by the AI: the panel they delimit must have a
 * dark header band, a light table and at least one player row. Returns the rectified panel,
 * reused for the reading, or `null` when the corners are refused.
 */
export async function acceptCorners(photo: Buffer, corners: Corners): Promise<GrayImage | null> {
  return acceptOnGray(await decodeGray(photo), corners);
}

/** Size of the long side of the working copy the panel is searched on. */
const WORK_SIZE = 1000;
/** Light blur on the working copy: smooths the screen's pixel grid and JPEG noise. */
const WORK_BLUR_SIGMA = 1;
/** A light component smaller than this share of the working copy cannot be the table. */
const MIN_COMPONENT_SHARE = 0.1;
/** A row (or column) at least this share of the median one crosses the whole table. */
const FULL_SPAN_SHARE = 0.9;
/**
 * Panel corners found from a table inside the photo may land just outside it: they are the
 * intersections of the straight edges, beyond the rounded corners, give or take the fit. Within
 * this margin (the detection's precision) they are put back on the photo border.
 */
const BORDER_SNAP = 0.01;
/** Second pass on the Otsu threshold, for a screen darker than expected (design §2). */
const DARK_SCREEN_SHIFT = -20;

async function workingCopy(photo: Buffer): Promise<GrayImage> {
  const { data, info } = await sharp(photo)
    .rotate()
    .grayscale()
    .resize(WORK_SIZE, WORK_SIZE, { fit: "inside" })
    .blur(WORK_BLUR_SIGMA)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/** Crossing-number test, on a polygon given in pixels. */
function inside(polygon: readonly Point[], x: number, y: number): boolean {
  let crossings = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    if (p.y > y !== q.y > y && x < p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y)) crossings++;
  }
  return crossings % 2 === 1;
}

/**
 * Which pixels of the working copy are searched: all of them, or those inside `within`. Only the
 * polygon's bounding box, one pixel wider on each side, is tested: a pixel beyond it crosses no
 * edge, or all of them (an even count), so it is outside.
 */
function searchMask(image: GrayImage, within: Corners | undefined): Uint8Array {
  const { width, height } = image;
  if (!within) return new Uint8Array(width * height).fill(1);
  const mask = new Uint8Array(width * height);
  const polygon = cornerList(within).map((p) => ({ x: p.x * width, y: p.y * height }));
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const x1 = Math.min(width, Math.ceil(Math.max(...xs)) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const y1 = Math.min(height, Math.ceil(Math.max(...ys)) + 1);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (inside(polygon, x + 0.5, y + 0.5)) mask[y * width + x] = 1;
    }
  }
  return mask;
}

/** Otsu's threshold on the searched pixels: grey levels above it are light. */
function otsuThreshold(image: GrayImage, mask: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);
  let total = 0;
  let sum = 0;
  const { data } = image;
  for (let i = 0; i < data.length; i++) {
    if (!mask[i]) continue;
    const v = data[i];
    histogram[v]++;
    total++;
    sum += v;
  }
  let best = 0;
  let bestVariance = -1;
  let below = 0;
  let belowSum = 0;
  for (let t = 0; t < 256; t++) {
    below += histogram[t];
    belowSum += t * histogram[t];
    const above = total - below;
    if (below === 0 || above === 0) continue;
    const meanGap = belowSum / below - (sum - belowSum) / above;
    const variance = below * above * meanGap * meanGap;
    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }
  return best;
}

/** Buffers of the flood fills over the light searched pixels of the working copy. */
type FloodFill = {
  image: GrayImage;
  mask: Uint8Array;
  threshold: number;
  seen: Uint8Array;
  stack: Int32Array;
  pixels: Int32Array;
};

/** A light searched pixel that no fill has reached yet. */
function isLight(flood: FloodFill, i: number): boolean {
  return !flood.seen[i] && flood.mask[i] === 1 && flood.image.data[i] > flood.threshold;
}

/**
 * Flood fill from `start` on an explicit stack, neighbours left, right, above, below. Writes the
 * component's pixels, in visit order, at the start of `flood.pixels`, and says whether one of
 * them is on the photo border.
 */
function fill(flood: FloodFill, start: number): { count: number; onBorder: boolean } {
  const { seen, stack, pixels } = flood;
  const { width } = flood.image;
  const size = seen.length;
  let top = 0;
  let count = 0;
  let onBorder = false;
  const push = (n: number) => {
    if (!isLight(flood, n)) return;
    seen[n] = 1;
    stack[top++] = n;
  };
  push(start);
  while (top > 0) {
    const i = stack[--top];
    pixels[count++] = i;
    const x = i % width;
    if (x === 0 || x === width - 1 || i < width || i >= size - width) onBorder = true;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < size - width) push(i + width);
  }
  return { count, onBorder };
}

/**
 * 4-connected components of the light searched pixels, largest first, each as pixel indices.
 * A component that reaches the photo border is left out: the table's sides are the panel's, so
 * the frame cuts the panel and its corners are not on the photo.
 */
function lightComponents(image: GrayImage, mask: Uint8Array, threshold: number): Int32Array[] {
  const size = image.width * image.height;
  const flood: FloodFill = {
    image,
    mask,
    threshold,
    seen: new Uint8Array(size),
    stack: new Int32Array(size),
    pixels: new Int32Array(size),
  };
  const components: Int32Array[] = [];
  const minSize = MIN_COMPONENT_SHARE * size;
  for (let start = 0; start < size; start++) {
    if (!isLight(flood, start)) continue;
    const { count, onBorder } = fill(flood, start);
    if (count >= minSize && !onBorder) components.push(flood.pixels.slice(0, count));
  }
  return components.sort((a, b) => b.length - a.length);
}

/** Line through edge points given as (along, across): across = slope·along + intercept. */
function edgeLine(points: Point[], across: "x" | "y"): Line {
  const { slope, intercept } = fitEdge(points);
  return across === "y" ? { a: -slope, b: 1, c: intercept } : { a: 1, b: -slope, c: intercept };
}

/**
 * Which rows (or columns) of the component cross it from one side to the other. On a tilted
 * photo, the rows next to the top and bottom edges are cut short by them: their ends lie on
 * those edges, not on the left and right ones, and are too many for the outlier trim.
 */
function fullSpans(start: number[], end: number[]): boolean[] {
  const spans = start.map((v, i) => end[i] - v);
  const sorted = spans.filter(Number.isFinite).sort((a, b) => a - b);
  const medianSpan = sorted[sorted.length >> 1];
  return spans.map((span) => Number.isFinite(span) && span >= FULL_SPAN_SHARE * medianSpan);
}

/**
 * The table's quadrilateral on the working copy, in pixels, clockwise from the top left: one
 * robust line per side through the component's outermost pixels, row by row and column by column.
 */
function tableQuad(component: Int32Array, width: number, height: number): Point[] {
  const left = new Array<number>(height).fill(Number.POSITIVE_INFINITY);
  const right = new Array<number>(height).fill(Number.NEGATIVE_INFINITY);
  const top = new Array<number>(width).fill(Number.POSITIVE_INFINITY);
  const bottom = new Array<number>(width).fill(Number.NEGATIVE_INFINITY);
  for (const i of component) {
    const x = i % width;
    const y = (i - x) / width;
    left[y] = Math.min(left[y], x);
    right[y] = Math.max(right[y], x + 1);
    top[x] = Math.min(top[x], y);
    bottom[x] = Math.max(bottom[x], y + 1);
  }
  const rows = fullSpans(left, right);
  const columns = fullSpans(top, bottom);
  const points = (edge: number[], kept: boolean[]) =>
    edge.flatMap((v, at) => (kept[at] ? [{ x: at + 0.5, y: v }] : []));
  const leftLine = edgeLine(points(left, rows), "x");
  const rightLine = edgeLine(points(right, rows), "x");
  const topLine = edgeLine(points(top, columns), "y");
  const bottomLine = edgeLine(points(bottom, columns), "y");
  return [
    intersect(topLine, leftLine),
    intersect(topLine, rightLine),
    intersect(bottomLine, rightLine),
    intersect(bottomLine, leftLine),
  ];
}

function normalised(quad: Point[], work: GrayImage): Corners {
  const [topLeft, topRight, bottomRight, bottomLeft] = quad.map((p) => ({
    x: p.x / work.width,
    y: p.y / work.height,
  }));
  return { topLeft, topRight, bottomRight, bottomLeft };
}

/** Panel corners, normalised on the photo, from the table's quadrilateral via `TABLE_RECT`. */
function panelCorners(table: Point[], work: GrayImage): Corners {
  const { width: W, height: H } = GSPRO_PANEL;
  const x0 = TABLE_RECT.x * W;
  const y0 = TABLE_RECT.y * H;
  const x1 = (TABLE_RECT.x + TABLE_RECT.width) * W;
  const y1 = (TABLE_RECT.y + TABLE_RECT.height) * H;
  const toWork = computeHomography(
    [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    table,
  );
  const panel = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  return normalised(
    panel.map((p) => applyHomography(toWork, p)),
    work,
  );
}

function snapToPhoto(corners: Corners): Corners {
  const snap = (v: number) =>
    v < 0 && v >= -BORDER_SNAP ? 0 : v > 1 && v <= 1 + BORDER_SNAP ? 1 : v;
  const point = (p: Point) => ({ x: snap(p.x), y: snap(p.y) });
  return {
    topLeft: point(corners.topLeft),
    topRight: point(corners.topRight),
    bottomRight: point(corners.bottomRight),
    bottomLeft: point(corners.bottomLeft),
  };
}

/** Accepted panel corners, the rectified panel, and the table quadrilateral it came from. */
export type DetectedPanel = { corners: Corners; panel: GrayImage; table: Corners };

/**
 * Finds the panel on the photo without help (design §2): the light table, bordered by the dark
 * HOLE row above and the dark ROUND SETTINGS band below, gives the panel through `TABLE_RECT`.
 * Each candidate goes through the same check as `acceptCorners`; the first accepted one wins.
 * `within` (normalised, may reach outside the photo) limits the search to a quadrilateral.
 */
export async function detectPanel(
  photo: Buffer,
  options: { within?: Corners } = {},
): Promise<DetectedPanel | null> {
  const work = await workingCopy(photo);
  const mask = searchMask(work, options.within);
  const otsu = otsuThreshold(work, mask);
  // The full-size decode is for the check only: done once, and only if a candidate gets there.
  let source: GrayImage | undefined;
  for (const threshold of [otsu, otsu + DARK_SCREEN_SHIFT]) {
    for (const component of lightComponents(work, mask, threshold)) {
      const table = tableQuad(component, work.width, work.height);
      const corners = snapToPhoto(panelCorners(table, work));
      if (!isPlausibleQuad(corners)) continue;
      source ??= await decodeGray(photo);
      const panel = acceptOnGray(source, corners);
      if (panel) return { corners, panel, table: normalised(table, work) };
    }
  }
  return null;
}
