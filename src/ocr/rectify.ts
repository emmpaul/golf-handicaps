import sharp from "sharp";
import type { Corners } from "./corners";
import { applyHomography } from "./homography";
import type { GrayImage } from "./image";
import { GSPRO_PANEL } from "./layouts/gspro";
import { panelToPhoto } from "./panel-homography";

function sampleBilinear(source: GrayImage, x: number, y: number): number {
  const x0 = Math.min(Math.max(Math.floor(x), 0), source.width - 2);
  const y0 = Math.min(Math.max(Math.floor(y), 0), source.height - 2);
  const fx = Math.min(Math.max(x - x0, 0), 1);
  const fy = Math.min(Math.max(y - y0, 0), 1);
  const i = y0 * source.width + x0;
  const top = source.data[i] * (1 - fx) + source.data[i + 1] * fx;
  const bottom = source.data[i + source.width] * (1 - fx) + source.data[i + source.width + 1] * fx;
  return top * (1 - fy) + bottom * fy;
}

export async function decodeGray(photo: Buffer): Promise<GrayImage> {
  const { data, info } = await sharp(photo)
    .rotate()
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

/** Warps the panel delimited by `corners` onto a GSPro-sized rectangle (bilinear sampling). */
export async function rectifyPanel(photo: Buffer, corners: Corners): Promise<GrayImage> {
  return rectifyGray(await decodeGray(photo), corners);
}

/** `rectifyPanel` on a photo already decoded by `decodeGray`. */
export function rectifyGray(source: GrayImage, corners: Corners): GrayImage {
  const { width, height } = GSPRO_PANEL;
  const toPhoto = panelToPhoto(corners, source, { width, height });
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = applyHomography(toPhoto, { x: x + 0.5, y: y + 0.5 });
      data[y * width + x] = Math.round(sampleBilinear(source, p.x - 0.5, p.y - 0.5));
    }
  }
  return { width, height, data };
}
