import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { MessagesClient } from "@/ai/claude-call";
import { ClaudeRatingReader } from "@/ai/rating-reader";
import { BETHPAGE_TEES, SGT_SCORECARD_30 } from "../sgt";
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

/** Ligne « Slope/Rating » de la carte de Bethpage Black, recopiée à la main. */
const BETHPAGE = {
  found: true,
  par: 71,
  tees: [
    { name: "Blue", rating: 77.5, slope: 155 },
    { name: "White", rating: 74.2, slope: 148 },
    { name: "Red", rating: 71.4, slope: 144 },
    { name: "Junior", rating: 71.0, slope: 120 },
    { name: "PAR3", rating: 54.0, slope: 120 },
  ],
};

/** Requête envoyée pour la carte, quelle que soit la réponse. */
async function request() {
  const { client, calls } = fakeClient();
  await new ClaudeRatingReader(client).read(SGT_SCORECARD_30).catch(() => undefined);
  expect(calls).toHaveLength(1);
  return calls[0];
}

describe("ClaudeRatingReader, requête", () => {
  it("accepte le vrai client du SDK (vérifié par pnpm typecheck), sans l'appeler", () => {
    const real: MessagesClient = new Anthropic({ apiKey: "sk-ant-test" });
    expect(new ClaudeRatingReader(real)).toBeInstanceOf(ClaudeRatingReader);
  });

  // Mutation : passer LOCATE_MAX_TOKENS (2 000) au lieu de RATING_MAX_TOKENS.
  it("demande les tees à claude-opus-5-5, effort low, 1 500 tokens, sortie structurée", async () => {
    const call = await request();
    expect(requestShape(call)).toEqual({
      options: { timeout: 60000, maxRetries: 1 },
      keys: ["max_tokens", "messages", "model", "output_config", "system"],
      model: "claude-opus-5-5",
      maxTokens: 1500,
      effort: "low",
      format: "json_schema",
      properties: ["found", "par", "tees"],
      messages: 1,
    });
    expect(call.body.system).toContain("Slope/Rating");
  });

  // Mutation : réencoder la carte (sharp, JPEG q85) au lieu de l'envoyer telle quelle.
  it("envoie la carte SGT seule, octet pour octet", async () => {
    const images = sentImages(await request());
    expect(images).toHaveLength(1);
    expect(images[0].equals(SGT_SCORECARD_30)).toBe(true);
  });
});

const readOn = (client: MessagesClient) => new ClaudeRatingReader(client).read(SGT_SCORECARD_30);

const failure = (response: Partial<FakeResponse>) => failureOf(readOn, response);

const answer = (json: object) => ({ content: [text(JSON.stringify(json))] });

describe("ClaudeRatingReader, réponse", () => {
  // Mutation : rendre `rating` tel quel au lieu de le passer en dixièmes.
  it("rend le par, les tees en dixièmes et l'usage facturé d'une réponse « found: true »", async () => {
    const { client } = fakeClient(answer(BETHPAGE));
    expect(await new ClaudeRatingReader(client).read(SGT_SCORECARD_30)).toEqual({
      card: { par: 71, tees: BETHPAGE_TEES },
      usage: USAGE,
    });
  });

  // Mutation : ignorer `found` et rendre les tees quand même.
  it("rend null et l'usage facturé d'une réponse « found: false »", async () => {
    const { client } = fakeClient(answer({ ...BETHPAGE, found: false }));
    expect(await new ClaudeRatingReader(client).read(SGT_SCORECARD_30)).toEqual({
      card: null,
      usage: USAGE,
    });
  });

  itRejectsStopReasons(readOn, JSON.stringify(BETHPAGE));

  // Mutation : retirer `.max(155)` du slope.
  it("lève une erreur « invalid » qui porte l'usage, sur un slope de 160", async () => {
    const tees = [{ name: "Red", rating: 71.4, slope: 160 }];
    expect(await failure(answer({ ...BETHPAGE, tees }))).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });

  // Mutation : retirer `.min(40)` de la rating.
  it("lève une erreur « invalid » qui porte l'usage, sur une rating de 39,9", async () => {
    const tees = [{ name: "Red", rating: 39.9, slope: 144 }];
    expect(await failure(answer({ ...BETHPAGE, tees }))).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });

  // Mutation : `z.number()` au lieu de `z.number().int()` pour le slope.
  it("lève une erreur « invalid » qui porte l'usage, sur un slope décimal (144,5)", async () => {
    const tees = [{ name: "Red", rating: 71.4, slope: 144.5 }];
    expect(await failure(answer({ ...BETHPAGE, tees }))).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });
});
