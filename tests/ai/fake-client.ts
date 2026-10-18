import type Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { AiCompletionError, type MessagesClient } from "@/ai/claude-call";

export type FakeResponse = Awaited<ReturnType<MessagesClient["messages"]["create"]>>;
export type Call = {
  body: Anthropic.MessageCreateParamsNonStreaming;
  options: Anthropic.RequestOptions;
};

/** Faux client : enregistre chaque requête et rend la réponse donnée. */
export function fakeClient(response: Partial<FakeResponse> = {}): {
  client: MessagesClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const client: MessagesClient = {
    messages: {
      async create(body, options) {
        calls.push({ body, options });
        return {
          model: "claude-opus-5-5",
          stop_reason: "end_turn",
          content: [],
          usage: { input_tokens: 1700, output_tokens: 900 },
          ...response,
        };
      },
    },
  };
  return { client, calls };
}

export const text = (json: string): Anthropic.TextBlock => ({
  type: "text",
  text: json,
  citations: null,
});

/** Usage que rend le faux client par défaut. */
export const USAGE = { model: "claude-opus-5-5", inputTokens: 1700, outputTokens: 900 };

/** Images de la requête, chacune en JPEG base64, décodées en buffers. */
export function sentImages(call: Call): Buffer[] {
  const blocks = call.body.messages[0].content as Anthropic.ContentBlockParam[];
  return blocks
    .filter((b): b is Anthropic.ImageBlockParam => b.type === "image")
    .map((image) => {
      const source = image.source as Anthropic.Base64ImageSource;
      expect([source.type, source.media_type]).toEqual(["base64", "image/jpeg"]);
      return Buffer.from(source.data, "base64");
    });
}

/** Forme d'une requête : options, clés du corps, modèle, bornes et sortie structurée. */
export function requestShape({ body, options }: Call) {
  return {
    options,
    keys: Object.keys(body).sort(),
    model: body.model,
    maxTokens: body.max_tokens,
    effort: body.output_config?.effort,
    format: body.output_config?.format?.type,
    properties: Object.keys(body.output_config?.format?.schema.properties as object),
    messages: body.messages.length,
  };
}

/** Appel testé, sur le faux client donné. */
export type Run = (client: MessagesClient) => Promise<unknown>;

/** Raison et usage portés par l'erreur typée que lève `run` sur la réponse donnée. */
export async function failureOf(run: Run, response: Partial<FakeResponse>): Promise<unknown> {
  const error = await run(fakeClient(response).client).then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiCompletionError);
  const { reason, usage } = error as AiCompletionError;
  return { reason, usage };
}

/** Refus et sortie tronquée lèvent l'erreur typée, avec l'usage ; `json` est une réponse valide. */
export function itRejectsStopReasons(run: Run, json: string) {
  it("lève une erreur « refusal » qui porte l'usage, sur un refus au contenu vide", async () => {
    expect(await failureOf(run, { stop_reason: "refusal", content: [] })).toEqual({
      reason: "refusal",
      usage: USAGE,
    });
  });

  it("lève une erreur « max_tokens » qui porte l'usage, sur une sortie tronquée", async () => {
    const truncated = { stop_reason: "max_tokens" as const, content: [text(json.slice(0, 30))] };
    expect(await failureOf(run, truncated)).toEqual({ reason: "max_tokens", usage: USAGE });
  });
}
