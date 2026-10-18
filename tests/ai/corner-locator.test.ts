import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { MessagesClient } from "@/ai/claude-call";
import { ClaudeCornerLocator } from "@/ai/corner-locator";
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

const { photo } = referencePhoto();

/** Coins écrits à la main, proches de ceux de la référence. */
const CORNERS = {
  topLeft: { x: 0.02, y: 0.22 },
  topRight: { x: 0.99, y: 0.24 },
  bottomRight: { x: 0.97, y: 0.88 },
  bottomLeft: { x: 0.04, y: 0.87 },
};

/** Requête envoyée pour `source`, quelle que soit la réponse. */
async function requestFor(source: Buffer) {
  const { client, calls } = fakeClient();
  await new ClaudeCornerLocator(client).locate(source).catch(() => undefined);
  expect(calls).toHaveLength(1);
  return calls[0];
}

/** Format, taille et métadonnées de chaque image envoyée pour `source`. */
async function sentMetadata(source: Buffer) {
  const images = sentImages(await requestFor(source));
  return Promise.all(
    images.map(async (image) => {
      const { format, width, height, exif, icc, xmp } = await sharp(image).metadata();
      return { format, width, height, exif, icc, xmp };
    }),
  );
}

const UPRIGHT_1568 = {
  format: "jpeg",
  width: 1568,
  height: 1176,
  exif: undefined,
  icc: undefined,
  xmp: undefined,
};

describe("ClaudeCornerLocator, requête", () => {
  it("accepte le vrai client du SDK (vérifié par pnpm typecheck), sans l'appeler", () => {
    const real: MessagesClient = new Anthropic({ apiKey: "sk-ant-test" });
    expect(new ClaudeCornerLocator(real)).toBeInstanceOf(ClaudeCornerLocator);
  });

  it("demande les 4 coins à claude-opus-5-5, effort low, 2 000 tokens, sortie structurée", async () => {
    const call = await requestFor(photo);
    expect(requestShape(call)).toEqual({
      options: { timeout: 60000, maxRetries: 1 },
      keys: ["max_tokens", "messages", "model", "output_config", "system"],
      model: "claude-opus-5-5",
      maxTokens: 2000,
      effort: "low",
      format: "json_schema",
      properties: ["found", "topLeft", "topRight", "bottomRight", "bottomLeft"],
      messages: 1,
    });
    expect(call.body.system).toContain("ROUND SETTINGS");
  });

  // Mutation : `keepMetadata()` garde l'EXIF, l'ICC et le XMP de la photo d'origine.
  it("envoie la référence 3000×2250 en une seule image JPEG 1568×1176 sans métadonnées", async () => {
    expect(await sentMetadata(photo)).toEqual([UPRIGHT_1568]);
  });

  // Mutation : oublier `rotate()` envoie l'image de côté, en 1176×1568.
  it("remet droite une photo enregistrée de côté avec l'orientation EXIF 6", async () => {
    const sideways = await sharp(photo).rotate(-90).withMetadata({ orientation: 6 }).toBuffer();
    expect(await sentMetadata(sideways)).toEqual([UPRIGHT_1568]);
  });

  // Mutation : retirer `withoutEnlargement` agrandit la photo à 1568 px.
  it("n'agrandit pas une photo de 1000×750", async () => {
    const small = await sharp(photo).resize(1000, 750).jpeg().toBuffer();
    expect(await sentMetadata(small)).toEqual([{ ...UPRIGHT_1568, width: 1000, height: 750 }]);
  });
});

const locateOn = (client: MessagesClient) => new ClaudeCornerLocator(client).locate(photo);

const failure = (response: Partial<FakeResponse>) => failureOf(locateOn, response);

const answer = (json: object) => ({ content: [text(JSON.stringify(json))] });

describe("ClaudeCornerLocator, réponse", () => {
  it("rend les coins et l'usage facturé d'une réponse « found: true »", async () => {
    const { client } = fakeClient(answer({ found: true, ...CORNERS }));
    expect(await new ClaudeCornerLocator(client).locate(photo)).toEqual({
      corners: CORNERS,
      usage: USAGE,
    });
  });

  // Mutation : ignorer `found` et rendre les coins quand même.
  it("rend null et l'usage facturé d'une réponse « found: false »", async () => {
    const { client } = fakeClient(answer({ found: false, ...CORNERS }));
    expect(await new ClaudeCornerLocator(client).locate(photo)).toEqual({
      corners: null,
      usage: USAGE,
    });
  });

  itRejectsStopReasons(locateOn, JSON.stringify({ found: true, ...CORNERS }));

  it("lève une erreur « invalid » qui porte l'usage, sur un JSON sans bottomLeft", async () => {
    const { bottomLeft: _, ...three } = CORNERS;
    expect(await failure(answer({ found: true, ...three }))).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });

  // Mutation : retirer les bornes 0–1 du schéma d'un point.
  it("lève une erreur « invalid » qui porte l'usage, sur un coin hors de l'image (x = 1,2)", async () => {
    const outside = { ...CORNERS, topRight: { x: 1.2, y: 0.24 } };
    expect(await failure(answer({ found: true, ...outside }))).toEqual({
      reason: "invalid",
      usage: USAGE,
    });
  });
});
