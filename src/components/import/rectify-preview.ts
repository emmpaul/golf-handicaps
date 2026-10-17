import type { Corners } from "@/ocr/corners";
import { applyHomography } from "@/ocr/homography";
import { GSPRO_PANEL } from "@/ocr/layouts/gspro";
import { panelToPhoto } from "@/ocr/panel-homography";

/** Aperçu à mi-résolution du panneau redressé : léger, l'OCR travaille sur le serveur. */
export const PREVIEW_SIZE = { width: GSPRO_PANEL.width / 2, height: GSPRO_PANEL.height / 2 };

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Photo illisible"));
    image.src = url;
  });
}

function pixelsOf(image: HTMLImageElement): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Redresse le panneau délimité par `corners` (homographie, plus proche voisin) et rend
 * une URL d'image de la carte, à la proportion du panneau GSPro.
 */
export async function rectifyPreview(photoUrl: string, corners: Corners): Promise<string> {
  const source = pixelsOf(await loadImage(photoUrl));
  const { width, height } = PREVIEW_SIZE;
  const toPhoto = panelToPhoto(corners, source, { width, height });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  const output = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = applyHomography(toPhoto, { x: x + 0.5, y: y + 0.5 });
      const sx = Math.min(Math.max(Math.floor(p.x), 0), source.width - 1);
      const sy = Math.min(Math.max(Math.floor(p.y), 0), source.height - 1);
      const from = (sy * source.width + sx) * 4;
      const to = (y * width + x) * 4;
      output.data.set(source.data.subarray(from, from + 4), to);
    }
  }
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.85);
}
