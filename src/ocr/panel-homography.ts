import type { Corners } from "./corners";
import { computeHomography, type Homography } from "./homography";

type Size = { width: number; height: number };

/**
 * Homographie qui envoie un point du panneau redressé (`panel`, en pixels) sur la photo
 * (`photo`, en pixels), d'après les 4 coins normalisés entre 0 et 1. Partagée par le
 * redressement serveur et l'aperçu du navigateur.
 */
export function panelToPhoto(corners: Corners, photo: Size, panel: Size): Homography {
  const { width, height } = panel;
  return computeHomography(
    [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].map((p) => ({
      x: p.x * photo.width,
      y: p.y * photo.height,
    })),
  );
}
