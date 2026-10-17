import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import type { GrayImage } from "@/ocr/image";
import { type AiCard, aiCardSchema } from "./card";
import { AI_MAX_TOKENS, AI_MODEL } from "./model";

/** La seule méthode du SDK appelée ; le vrai client `Anthropic` la satisfait. */
export type MessagesClient = {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options: Anthropic.RequestOptions,
    ): Promise<{
      model: string;
      stop_reason: Anthropic.StopReason | null;
      content: Anthropic.ContentBlock[];
      usage: Pick<Anthropic.Usage, "input_tokens" | "output_tokens">;
    }>;
  };
};

/** Tokens facturés d'un appel, réflexion comprise, et le modèle qui a répondu. */
export type AiUsage = { model: string; inputTokens: number; outputTokens: number };

/** Pourquoi la réponse ne donne pas de carte : refus, sortie tronquée, ou JSON hors schéma. */
export type AiFailureReason = "refusal" | "max_tokens" | "invalid";

/** Appel facturé sans carte exploitable : l'erreur porte l'usage, pour le budget. */
export class AiCompletionError extends Error {
  constructor(
    readonly reason: AiFailureReason,
    readonly usage: AiUsage,
    options?: ErrorOptions,
  ) {
    super(`Complétion IA impossible : ${reason}`, options);
    this.name = "AiCompletionError";
  }
}

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
    const response = await this.client.messages.create(
      {
        model: AI_MODEL,
        max_tokens: AI_MAX_TOKENS,
        system: SYSTEM,
        output_config: { effort: "low", format: this.format },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: await panelJpeg(panel) },
              },
              { type: "text", text: "Recopie cette carte de score." },
            ],
          },
        ],
      },
      { timeout: 60_000, maxRetries: 1 },
    );
    const usage: AiUsage = {
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
    // Un refus peut arriver avec un contenu vide : on regarde stop_reason avant le contenu.
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      throw new AiCompletionError(response.stop_reason, usage);
    }
    const block = response.content.find((b) => b.type === "text");
    try {
      return { card: this.format.parse(block?.text ?? ""), usage };
    } catch (cause) {
      throw new AiCompletionError("invalid", usage, { cause });
    }
  }
}
