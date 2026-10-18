import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import * as z from "zod/v4";
import type { Corners } from "@/ocr/corners";
import { type AiUsage, askAboutImage, type MessagesClient } from "./claude-call";
import { LOCATE_MAX_TOKENS } from "./model";

/**
 * Point en coordonnées 0–1 de l'image envoyée. La sortie structurée n'applique pas les
 * bornes : c'est `parse` (zod) qui rejette un point hors de l'image.
 */
const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

/** Réponse du cadrage (design, décision 4) : `found` faux quand aucune carte n'est visible. */
const cornersSchema = z.object({
  found: z.boolean(),
  topLeft: point,
  topRight: point,
  bottomRight: point,
  bottomLeft: point,
});

/** Cadrage par l'IA : les 4 coins du panneau sur la photo, `null` si Claude ne le voit pas. */
export interface CornerLocator {
  locate(photo: Buffer): Promise<{ corners: Corners | null; usage: AiUsage }>;
}

/** Prompt fixe : les deux repères du panneau GSPro et le repère des coordonnées. */
const SYSTEM = `Tu regardes la photo d'un écran de simulateur de golf GSPro qui affiche une carte de score.

Le panneau de la carte va du coin haut gauche du bandeau sombre qui porte le nom du parcours, en haut, jusqu'au coin bas droit de la bande sombre « ROUND SETTINGS », en bas. Entre les deux se trouve un grand tableau clair : numéros de trou, PAR, INDEX, distances, puis une ligne par joueur. Le logo du simulateur, au-dessus du panneau, n'en fait pas partie.

Donne les 4 coins de ce panneau, dans le sens des aiguilles d'une montre depuis le haut gauche : topLeft, topRight, bottomRight, bottomLeft. Chaque point est en coordonnées de l'image, de 0 à 1 : x = 0 au bord gauche, 1 au bord droit ; y = 0 au bord haut, 1 au bord bas. La photo peut être prise de biais : les coins ne forment pas forcément un rectangle.

Si aucune carte de score GSPro n'est visible, mets found à false.`;

/**
 * Photo remise droite selon son orientation, sans métadonnées, réduite à 1568 px au plus sur
 * son grand côté, en JPEG q85 (design, décision 4).
 */
async function photoJpeg(photo: Buffer): Promise<string> {
  const jpeg = await sharp(photo)
    .rotate()
    .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return jpeg.toString("base64");
}

/** Demande à Claude les coins du panneau, sur une copie réduite de la photo. */
export class ClaudeCornerLocator implements CornerLocator {
  private readonly format = betaZodOutputFormat(cornersSchema);

  constructor(private readonly client: MessagesClient) {}

  async locate(photo: Buffer): Promise<{ corners: Corners | null; usage: AiUsage }> {
    const { value, usage } = await askAboutImage(this.client, {
      system: SYSTEM,
      maxTokens: LOCATE_MAX_TOKENS,
      format: this.format,
      jpegBase64: await photoJpeg(photo),
      instruction: "Donne les 4 coins du panneau de la carte de score.",
    });
    const { found, ...corners } = value;
    return { corners: found ? corners : null, usage };
  }
}
