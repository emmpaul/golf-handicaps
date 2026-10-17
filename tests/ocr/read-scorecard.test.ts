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
    const { draft, panel } = await readScorecard(photo, corners);
    expect(draft).toEqual(EXPECTED);
    // Le panneau redressé est rendu avec le brouillon, pour l'envoyer à l'IA sans redresser deux fois.
    expect([panel.width, panel.height]).toEqual([2400, 1224]);
  }, 60_000);
});
