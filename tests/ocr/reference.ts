import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Corners } from "@/ocr/corners";
import type { GrayImage } from "@/ocr/image";

const FIXTURES = resolve(__dirname, "../fixtures/scorecards");

/** The reference photo IMG_3064 and its hand-measured panel corners. */
export function referencePhoto(): { photo: Buffer; corners: Corners } {
  return {
    photo: readFileSync(resolve(FIXTURES, "gspro-img3064.jpg")),
    corners: JSON.parse(readFileSync(resolve(FIXTURES, "gspro-img3064.corners.json"), "utf8")),
  };
}

/** Mean grey level of a region given in fractions of the image size. */
export function meanIn(
  image: GrayImage,
  zone: { x: number; y: number; width: number; height: number },
): number {
  const x0 = Math.round(zone.x * image.width);
  const y0 = Math.round(zone.y * image.height);
  const x1 = Math.round((zone.x + zone.width) * image.width);
  const y1 = Math.round((zone.y + zone.height) * image.height);
  let sum = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) sum += image.data[y * image.width + x];
  }
  return sum / ((x1 - x0) * (y1 - y0));
}
