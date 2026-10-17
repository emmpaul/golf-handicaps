import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { AiCompletionError, ClaudeDraftCompleter, type MessagesClient } from "@/ai/completer";
import type { GrayImage } from "@/ocr/image";
import { rectifyPanel } from "@/ocr/rectify";
import { referencePhoto } from "../ocr/reference";

type Response = Awaited<ReturnType<MessagesClient["messages"]["create"]>>;
type Call = { body: Anthropic.MessageCreateParamsNonStreaming; options: Anthropic.RequestOptions };

/** Faux client : enregistre chaque requête et rend la réponse donnée. */
function fakeClient(response: Partial<Response> = {}): { client: MessagesClient; calls: Call[] } {
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

let panel: GrayImage;

beforeAll(async () => {
  const { photo, corners } = referencePhoto();
  panel = await rectifyPanel(photo, corners);
});

describe("ClaudeDraftCompleter, requête", () => {
  it("accepte le vrai client du SDK (vérifié par pnpm typecheck), sans l'appeler", () => {
    const real: MessagesClient = new Anthropic({ apiKey: "sk-ant-test" });
    expect(new ClaudeDraftCompleter(real)).toBeInstanceOf(ClaudeDraftCompleter);
  });

  it("envoie le panneau redressé en une seule image JPEG 1568×800, effort low, sortie structurée", async () => {
    const { client, calls } = fakeClient();
    await new ClaudeDraftCompleter(client).complete(panel).catch(() => undefined);

    expect(calls).toHaveLength(1);
    const { body, options } = calls[0];
    expect(options).toEqual({ timeout: 60000, maxRetries: 1 });
    // Ni `fallbacks`, ni `betas`, ni `thinking` : seules ces clés partent.
    expect(Object.keys(body).sort()).toEqual([
      "max_tokens",
      "messages",
      "model",
      "output_config",
      "system",
    ]);
    expect(body.system).toContain("GSPro");
    expect(body.system).toContain("null");
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.max_tokens).toBe(4000);
    expect(body.output_config?.effort).toBe("low");
    expect(body.output_config?.format?.type).toBe("json_schema");
    expect(Object.keys(body.output_config?.format?.schema.properties as object)).toEqual([
      "courseName",
      "tees",
      "par",
      "strokeIndex",
      "distance",
      "players",
    ]);

    expect(body.messages).toHaveLength(1);
    const blocks = body.messages[0].content as Anthropic.ContentBlockParam[];
    const images = blocks.filter((b): b is Anthropic.ImageBlockParam => b.type === "image");
    expect(images).toHaveLength(1);
    const source = images[0].source as Anthropic.Base64ImageSource;
    expect(source.type).toBe("base64");
    expect(source.media_type).toBe("image/jpeg");
    const meta = await sharp(Buffer.from(source.data, "base64")).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1568, 800]);
  });
});

const row = (holes: (number | null)[], out: number, inn: number, total: number) => ({
  holes,
  out,
  in: inn,
  total,
});

/** Carte écrite à la main : les pars et index de la carte de référence, Gab au trou 9 = 5. */
const CARD = {
  courseName: "BETHPAGE BLACK",
  tees: "Red",
  par: row([4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 4, 3, 4], 36, 35, 71),
  strokeIndex: [9, 3, 13, 5, 7, 1, 11, 17, 15, 10, 4, 14, 2, 18, 8, 6, 16, 12],
  distance: row(Array(18).fill(null), 3226, 3204, 6430),
  players: [
    {
      name: "GAB",
      scores: row([5, 5, 3, 5, 4, 4, 4, 3, 5, 4, 5, 4, 5, 3, 4, 4, 3, 4], 38, 36, 74),
    },
  ],
};

const text = (json: string): Anthropic.TextBlock => ({ type: "text", text: json, citations: null });

const USAGE = { model: "claude-opus-5-5", inputTokens: 1700, outputTokens: 900 };

/** Raison et usage portés par l'erreur typée que lève `complete`. */
async function failure(response: Partial<Response>): Promise<unknown> {
  const error = await new ClaudeDraftCompleter(fakeClient(response).client).complete(panel).then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AiCompletionError);
  const { reason, usage } = error as AiCompletionError;
  return { reason, usage };
}

describe("ClaudeDraftCompleter, réponse", () => {
  it("rend la carte parsée et l'usage facturé d'une réponse valide", async () => {
    const { client } = fakeClient({ content: [text(JSON.stringify(CARD))] });
    expect(await new ClaudeDraftCompleter(client).complete(panel)).toEqual({
      card: CARD,
      usage: USAGE,
    });
  });

  // Mutation : `usage.model` fixé à AI_MODEL au lieu du modèle que rend la réponse.
  it("facture le modèle nommé par la réponse, pas celui demandé", async () => {
    const { client } = fakeClient({
      model: "claude-opus-5-5-20261015",
      content: [text(JSON.stringify(CARD))],
    });
    const { usage } = await new ClaudeDraftCompleter(client).complete(panel);
    expect(usage.model).toBe("claude-opus-5-5-20261015");
  });

  it("lève une erreur « refusal » qui porte l'usage, sur un refus au contenu vide", async () => {
    expect(await failure({ stop_reason: "refusal", content: [] })).toEqual({
      reason: "refusal",
      usage: USAGE,
    });
  });

  it("lève une erreur « max_tokens » qui porte l'usage, sur une sortie tronquée", async () => {
    const truncated = JSON.stringify(CARD).slice(0, 40);
    expect(await failure({ stop_reason: "max_tokens", content: [text(truncated)] })).toEqual({
      reason: "max_tokens",
      usage: USAGE,
    });
  });

  it("lève une erreur « invalid » qui porte l'usage, sur un JSON hors schéma (17 pars)", async () => {
    const card = { ...CARD, par: { ...CARD.par, holes: CARD.par.holes.slice(0, 17) } };
    expect(await failure({ content: [text(JSON.stringify(card))] })).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });

  it("lève une erreur « invalid » qui porte l'usage, sur un texte qui n'est pas du JSON", async () => {
    expect(await failure({ content: [text("Je ne peux pas lire cette carte.")] })).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });

  it("lève une erreur « invalid » qui porte l'usage, sans bloc texte", async () => {
    expect(await failure({ content: [] })).toEqual({ reason: "invalid", usage: USAGE });
  });
});
