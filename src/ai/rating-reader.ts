import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import { type AiUsage, askAboutImage, type MessagesClient } from "./claude-call";
import { RATING_MAX_TOKENS } from "./model";

/**
 * Réponse de la lecture (design, décision 5) : `found` faux quand l'image n'est pas une
 * carte SGT. La sortie structurée n'applique pas les bornes : c'est `parse` (zod) qui
 * rejette une rating ou un slope hors des valeurs WHS.
 */
const cardSchema = z.object({
  found: z.boolean(),
  par: z.number().int(),
  tees: z.array(
    z.object({
      name: z.string(),
      rating: z.number().min(40).max(90),
      slope: z.number().int().min(55).max(155),
    }),
  ),
});

/** Un tee lu sur la carte, rating en dixièmes (`71.4` → 714). */
export type SgtTee = { name: string; ratingT: number; slope: number };

/** Par et tees lus sur une carte SGT. */
export type SgtCard = { par: number; tees: SgtTee[] };

/** Lecture par l'IA de la carte SGT d'un parcours, `null` si l'image n'en est pas une. */
export interface RatingReader {
  read(scorecard: Buffer): Promise<{ card: SgtCard | null; usage: AiUsage }>;
}

/** Prompt fixe : où trouver la ligne « Slope/Rating » et comment la lire. */
const SYSTEM = `Tu regardes l'image de carte de score d'un parcours publiée par Simulator Golf Tour (SGT).

Au-dessus des colonnes de tees, une ligne « Slope/Rating » donne, pour chaque tee, deux nombres au format rating/slope : la course rating, à une décimale (par exemple 71.4), puis le slope, entier (par exemple 144). Donne une entrée par colonne de tee, dans l'ordre de la carte, avec le nom du tee tel qu'il est écrit, sa rating et son slope. Donne aussi le par total du parcours.

Si l'image n'est pas une carte de score SGT, mets found à false.`;

/** Demande à Claude la rating et le slope de chaque tee, sur la carte SGT telle que servie. */
export class ClaudeRatingReader implements RatingReader {
  private readonly format = betaZodOutputFormat(cardSchema);

  constructor(private readonly client: MessagesClient) {}

  async read(scorecard: Buffer): Promise<{ card: SgtCard | null; usage: AiUsage }> {
    // La carte SGT est déjà un JPEG de 905×527 : elle part telle quelle, sans réencodage.
    const { value, usage } = await askAboutImage(this.client, {
      system: SYSTEM,
      maxTokens: RATING_MAX_TOKENS,
      format: this.format,
      jpegBase64: scorecard.toString("base64"),
      instruction: "Donne le par et la rating et le slope de chaque tee de la carte.",
    });
    if (!value.found) return { card: null, usage };
    const tees = value.tees.map(({ name, rating, slope }) => ({
      name,
      ratingT: Math.round(rating * 10),
      slope,
    }));
    return { card: { par: value.par, tees }, usage };
  }
}
