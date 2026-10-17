import type { Rect } from "./layouts/gspro";

/** 8-bit single-channel image, row-major. */
export type GrayImage = { width: number; height: number; data: Uint8Array };

/** Crops a region given in fractions of the image size (clamped to the image). */
export function cropRelative(image: GrayImage, rect: Rect): GrayImage {
  const x0 = Math.max(0, Math.round(rect.x * image.width));
  const y0 = Math.max(0, Math.round(rect.y * image.height));
  const x1 = Math.min(image.width, Math.round((rect.x + rect.width) * image.width));
  const y1 = Math.min(image.height, Math.round((rect.y + rect.height) * image.height));
  const width = x1 - x0;
  const height = y1 - y0;
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    data.set(
      image.data.subarray((y0 + y) * image.width + x0, (y0 + y) * image.width + x1),
      y * width,
    );
  }
  return { width, height, data };
}
