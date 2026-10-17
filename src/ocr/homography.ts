export type Point = { x: number; y: number };

/** Row-major 3×3 matrix, h[8] = 1. */
export type Homography = readonly number[];

function pivotRow(a: number[][], col: number): number {
  let pivot = col;
  for (let row = col + 1; row < a.length; row++) {
    if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
  }
  if (Math.abs(a[pivot][col]) < 1e-12) throw new Error("Homographie dégénérée");
  return pivot;
}

function backSubstitute(a: number[][], b: number[]): number[] {
  const n = b.length;
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let k = row + 1; k < n; k++) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
}

/** Solves A·x = b in place by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    const pivot = pivotRow(a, col);
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = a[row][col] / a[col][col];
      for (let k = col; k < n; k++) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }
  return backSubstitute(a, b);
}

/** Homography sending each `from[i]` to `to[i]` (4 point pairs, 8×8 linear solve). */
export function computeHomography(from: readonly Point[], to: readonly Point[]): Homography {
  const a: number[][] = [];
  const b: number[] = [];
  from.forEach((p, i) => {
    const q = to[i];
    a.push([p.x, p.y, 1, 0, 0, 0, -p.x * q.x, -p.y * q.x]);
    b.push(q.x);
    a.push([0, 0, 0, p.x, p.y, 1, -p.x * q.y, -p.y * q.y]);
    b.push(q.y);
  });
  return [...solve(a, b), 1];
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}
