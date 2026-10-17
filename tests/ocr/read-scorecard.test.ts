import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readScorecard } from "@/ocr/read-scorecard";
import type { ScorecardDraft } from "@/scorecard/draft";
import { referencePhoto } from "./reference";

/** Hand-written from the photo IMG_3064 (see tests/fixtures/scorecards/README.md). */
const EXPECTED: ScorecardDraft = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/scorecards/gspro-img3064.draft.json"), "utf8"),
);

describe("readScorecard", () => {
  it("lit la carte de référence IMG_3064 sans aucune erreur ni case null", async () => {
    const { photo, corners } = referencePhoto();
    expect(await readScorecard(photo, corners)).toEqual(EXPECTED);
  }, 60_000);
});
