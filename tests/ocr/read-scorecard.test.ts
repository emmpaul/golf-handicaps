import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toStoredWebp } from "@/jobs/imports";
import { detectPanel } from "@/ocr/detect-panel";
import { readScorecard, readScorecardPanel } from "@/ocr/read-scorecard";
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
  });
});

// Ici plutôt que dans son propre fichier : lancée à la suite de la lecture ci-dessus, pour que la
// CI ne fasse jamais trois lectures complètes à la fois.
describe("readScorecard sur la photo stockée en WebP", () => {
  // Garde la qualité choisie (design, décision 2) : la photo de référence passée par la même
  // conversion que `createImport` doit donner la même lecture que le JPEG d'origine.
  // Mutation : qualité 20 dans `toStoredWebp` → la lecture change (tees null au lieu de "Red") et
  // le test casse.
  it("lit la carte de référence IMG_3064 convertie en WebP sans aucune erreur", async () => {
    const { photo, corners } = referencePhoto();
    const { draft } = await readScorecard(await toStoredWebp(photo), corners);
    expect(draft).toEqual(EXPECTED);
  });
});

// Même fichier, lancée à la suite, pour la même raison que ci-dessus.
describe("detectPanel puis readScorecardPanel", () => {
  // Le parcours du job sans coins (design §3 et §5) : le panneau redressé à la vérification sert
  // tel quel à la lecture. Mutation : `TABLE_RECT` qui commence 40 px plus bas (y = 260) → les
  // coins déduits du tableau décalent le panneau et la lecture change.
  it("lit la carte de référence IMG_3064 trouvée sans coins comme avec les coins mesurés", async () => {
    const { photo } = referencePhoto();
    const found = await detectPanel(photo);
    if (!found) throw new Error("Panneau de la référence introuvable");
    expect(await readScorecardPanel(found.panel)).toEqual(EXPECTED);
  });
});
