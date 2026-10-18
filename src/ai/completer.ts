import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import type { GrayImage } from "@/ocr/image";
import { type AiCard, aiCardSchema } from "./card";
import { type AiUsage, askAboutImage, type MessagesClient } from "./claude-call";
import { AI_MAX_TOKENS } from "./model";

export interface DraftCompleter {
  complete(panel: GrayImage): Promise<{ card: AiCard; usage: AiUsage }>;
}

/** Prompt fixe : la carte GSPro et la consigne de recopier sans corriger (design, décision 3). */
const SYSTEM = `Tu lis la photo redressée d'une carte de score du simulateur de golf GSPro.

En haut, un bandeau donne le nom du parcours, puis une ligne de réglages qui contient les tees (par exemple « Red »).
Le tableau a une colonne par trou, de 1 à 18, avec trois colonnes de totaux : OUT après le trou 9 (trous 1 à 9), IN après le trou 18 (trous 10 à 18) et TOT (OUT + IN).
Ses lignes, de haut en bas : les numéros de trou, PAR, INDEX (difficulté du trou, de 1 à 18, sans totaux), la distance de chaque trou, puis une ligne par joueur, avec son nom à gauche, ses 18 scores et ses totaux. Les lignes de joueur vides sont à ignorer.
Certains scores sont encadrés ou cerclés selon leur écart au par : recopie seulement le chiffre.

Recopie exactement ce qui est affiché, même si une somme te paraît fausse : ne corrige rien, ne calcule rien. Pour une case vide ou illisible, mets null plutôt que de deviner.`;

/** Panneau redressé en JPEG q85, ramené à 1568×800 (design, décision 3). */
async function panelJpeg(panel: GrayImage): Promise<string> {
  const jpeg = await sharp(Buffer.from(panel.data), {
    raw: { width: panel.width, height: panel.height, channels: 1 },
  })
    .resize(1568, 800, { fit: "fill" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return jpeg.toString("base64");
}

/** Complète une carte avec Claude, à partir du seul panneau redressé. */
export class ClaudeDraftCompleter implements DraftCompleter {
  private readonly format = betaZodOutputFormat(aiCardSchema);

  constructor(private readonly client: MessagesClient) {}

  async complete(panel: GrayImage): Promise<{ card: AiCard; usage: AiUsage }> {
    const { value: card, usage } = await askAboutImage(this.client, {
      system: SYSTEM,
      maxTokens: AI_MAX_TOKENS,
      format: this.format,
      jpegBase64: await panelJpeg(panel),
      instruction: "Recopie cette carte de score.",
    });
    return { card, usage };
  }
}
