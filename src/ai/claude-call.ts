import type Anthropic from "@anthropic-ai/sdk";
import type { AutoParseableBetaOutputFormat } from "@anthropic-ai/sdk/lib/beta-parser";
import { AI_MODEL } from "./model";

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

/** Pourquoi la réponse est inexploitable : refus, sortie tronquée, ou JSON hors schéma. */
export type AiFailureReason = "refusal" | "max_tokens" | "invalid";

/** Appel facturé sans réponse exploitable : l'erreur porte l'usage, pour le budget. */
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

/** Un appel à une image : prompt système, image JPEG en base64 et consigne. */
export type ImageRequest<T> = {
  system: string;
  maxTokens: number;
  format: AutoParseableBetaOutputFormat<T>;
  jpegBase64: string;
  instruction: string;
};

/**
 * Envoie une image à Claude, effort `low`, et parse la sortie structurée. Un refus, une
 * sortie tronquée ou un JSON hors schéma lèvent `AiCompletionError` avec l'usage facturé.
 */
export async function askAboutImage<T>(
  client: MessagesClient,
  { system, maxTokens, format, jpegBase64, instruction }: ImageRequest<T>,
): Promise<{ value: T; usage: AiUsage }> {
  const response = await client.messages.create(
    {
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      output_config: { effort: "low", format },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 },
            },
            { type: "text", text: instruction },
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
    return { value: format.parse(block?.text ?? ""), usage };
  } catch (cause) {
    throw new AiCompletionError("invalid", usage, { cause });
  }
}
