import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import type { MessagesClient } from "@/ai/claude-call";
import { ClaudeDraftCompleter } from "@/ai/completer";
import type { GrayImage } from "@/ocr/image";
import { rectifyPanel } from "@/ocr/rectify";
import { referencePhoto } from "../ocr/reference";
import {
  type FakeResponse,
  failureOf,
  fakeClient,
  itRejectsStopReasons,
  requestShape,
  sentImages,
  text,
  USAGE,
} from "./fake-client";

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
    // Ni `fallbacks`, ni `betas`, ni `thinking` : seules ces clés partent.
    expect(requestShape(calls[0])).toEqual({
      options: { timeout: 60000, maxRetries: 1 },
      keys: ["max_tokens", "messages", "model", "output_config", "system"],
      model: "claude-opus-5-5",
      maxTokens: 4000,
      effort: "low",
      format: "json_schema",
      properties: ["courseName", "tees", "par", "strokeIndex", "distance", "players"],
      messages: 1,
    });
    expect(calls[0].body.system).toContain("GSPro");
    expect(calls[0].body.system).toContain("null");
    const images = sentImages(calls[0]);
    expect(images).toHaveLength(1);
    const meta = await sharp(images[0]).metadata();
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

const completeOn = (client: MessagesClient) => new ClaudeDraftCompleter(client).complete(panel);

const failure = (response: Partial<FakeResponse>) => failureOf(completeOn, response);

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

  itRejectsStopReasons(completeOn, JSON.stringify(CARD));

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
