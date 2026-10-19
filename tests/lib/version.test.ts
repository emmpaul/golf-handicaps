import { describe, expect, it } from "vitest";
import { parseCommit, releaseUrl, shortCommit, versionResponse } from "@/lib/version";

const SHA = "4794e1b0c0ffee00000000000000000000000000";

describe("parseCommit", () => {
  it("garde un sha complet en minuscules", () => {
    expect(parseCommit(SHA)).toBe("4794e1b0c0ffee00000000000000000000000000");
  });

  // Mutation : accepter toute chaîne non vide fait rougir le cas court.
  it.each([
    ["vide", ""],
    ["absent", undefined],
    ["court", "4794e1b"],
    ["en majuscules", "4794E1B0C0FFEE00000000000000000000000000"],
    ["non hexadécimal", "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"],
  ])("rejette un commit %s", (_label, raw) => {
    expect(parseCommit(raw)).toBeNull();
  });
});

describe("releaseUrl", () => {
  // Mutation : oublier le préfixe `v` du tag fait rougir ce test.
  it("pointe vers la release GitHub du tag v<version>", () => {
    expect(releaseUrl("0.6.0")).toBe(
      "https://github.com/emmpaul/golf-handicaps/releases/tag/v0.6.0",
    );
  });
});

describe("shortCommit", () => {
  it("garde les 7 premiers caractères du sha", () => {
    expect(shortCommit(SHA)).toBe("4794e1b");
  });
});

describe("versionResponse", () => {
  // Mutation : retirer l'en-tête `no-store` fait rougir ce test.
  it("répond 200 avec la version, le commit et sans cache", async () => {
    const response = versionResponse("0.6.0", SHA);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      version: "0.6.0",
      commit: "4794e1b0c0ffee00000000000000000000000000",
    });
  });

  it("répond commit null quand le build ne le connaît pas", async () => {
    const response = versionResponse("0.6.0", null);
    expect(await response.json()).toEqual({ version: "0.6.0", commit: null });
  });
});
