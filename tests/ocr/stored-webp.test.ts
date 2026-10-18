import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toStoredWebp } from "@/jobs/imports";
import { readScorecard } from "@/ocr/read-scorecard";
import type { ScorecardDraft } from "@/scorecard/draft";
import { referencePhoto } from "./reference";

/** Hand-written from the photo IMG_3064 (see tests/fixtures/scorecards/README.md). */
const EXPECTED: ScorecardDraft = JSON.parse(
  readFileSync(resolve(__dirname, "../fixtures/scorecards/gspro-img3064.draft.json"), "utf8"),
);

describe("readScorecard sur la photo stockée en WebP", () => {
  // Garde la qualité choisie (design, décision 2) : la photo de référence passée par la même
  // conversion que `createImport` doit donner la même lecture que le JPEG d'origine.
  // Mutation : qualité 20 dans `toStoredWebp` → la lecture change et le test casse.
  // 60 s : même lecture complète que tests/ocr/read-scorecard.test.ts.
  it("lit la carte de référence IMG_3064 convertie en WebP sans aucune erreur", async () => {
    const { photo, corners } = referencePhoto();
    const { draft } = await readScorecard(await toStoredWebp(photo), corners);
    expect(draft).toEqual(EXPECTED);
  }, 60_000);
});
