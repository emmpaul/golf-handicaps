/** Grand côté maximal de la photo envoyée au serveur (design, décision 5). */
export const MAX_PHOTO_SIDE = 3000;

const JPEG_QUALITY = 0.92;

/**
 * Décode la photo dans le navigateur (`createImageBitmap` : JPEG, PNG, WebP, HEIC sur
 * Safari) et la réencode en JPEG, 3000 px au plus sur le grand côté. Rejette si le
 * navigateur ne sait pas lire le fichier.
 */
export async function decodePhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encodage JPEG impossible"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}
