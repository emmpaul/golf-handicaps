import { spawn } from "node:child_process";
import sharp from "sharp";
import type { CellReader } from "./cell-reader";
import type { GrayImage } from "./image";

/** Native binary: on PATH in the Docker image (apt `tesseract-ocr`) and with Homebrew. */
const TESSERACT_BIN = process.env.TESSERACT_BIN ?? "tesseract";
/** Cells read at the same time by one reader. */
const CONCURRENCY = 4;

export type TesseractOptions = { psm: 6 | 7; whitelist?: string };

async function toPng(image: GrayImage): Promise<Buffer> {
  return sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 1 },
  })
    .png()
    .toBuffer();
}

/** Runs `tesseract stdin stdout` on an image and returns the recognised text. */
export async function runTesseract(image: GrayImage, options: TesseractOptions): Promise<string> {
  const args = ["stdin", "stdout", "--psm", String(options.psm), "--dpi", "300"];
  if (options.whitelist) args.push("-c", `tessedit_char_whitelist=${options.whitelist}`);
  const png = await toPng(image);
  return new Promise((resolve, reject) => {
    const child = spawn(TESSERACT_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`tesseract a échoué (code ${code}) : ${stderr.trim()}`));
    });
    child.stdin.end(png);
  });
}

/** Runs at most `limit` tasks at once. */
export function createLimiter(limit: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (running >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

/** Tesseract line mode (`--psm 7`) restricted to digits, 4 cells in parallel. */
export function createTesseractCellReader(): CellReader {
  const limit = createLimiter(CONCURRENCY);
  return {
    async read(cell) {
      const text = await limit(() => runTesseract(cell, { psm: 7, whitelist: "0123456789" }));
      const digits = text.replace(/\D/g, "");
      return digits === "" ? null : Number(digits);
    },
  };
}
