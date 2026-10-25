import { fourPlayerDraft, fourPlayerRound, seedPlayer, seedReadyImport, seedRound } from "./data";
import { expect, expectNoSideScroll, test } from "./fixtures";

// Spec `app-shell` « Aucun cadre défilant sur téléphone » (design D9) : chaque page de l'app, à
// 320 puis 390 px, avec un round et une carte lue de 4 joueurs, le cas le plus large.
// Mutation : la carte de score ou la grille de correction en 18 colonnes sous 768 px → rouge
// sur le round, sa modification, la correction et la saisie manuelle.

test.use({ hasTouch: true, isMobile: true });

type Seeded = { roundId: number; importId: number };

const ROUTES: [name: string, path: (seeded: Seeded) => string][] = [
  ["accueil", () => "/"],
  ["importer", () => "/import"],
  ["correction d'un import", ({ importId }) => `/imports/${importId}`],
  ["rounds", () => "/rounds"],
  ["round", ({ roundId }) => `/rounds/${roundId}`],
  ["modification d'un round", ({ roundId }) => `/rounds/${roundId}/edit`],
  ["nouveau round", () => "/rounds/new"],
  ["joueurs", () => "/players"],
  ["parcours", () => "/courses"],
  ["handicaps", () => "/handicaps"],
  ["coups", () => "/strokes"],
];

for (const width of [320, 390]) {
  for (const [name, path] of ROUTES) {
    test(`${width}px, ${name} : rien ne défile de côté`, async ({ page, players }) => {
      const Alex = seedPlayer("Alex");
      const roundId = seedRound(fourPlayerRound({ ...players, Alex }));
      const importId = seedReadyImport(fourPlayerDraft());
      await page.setViewportSize({ width, height: 844 });
      await page.goto(path({ roundId, importId }));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (name === "coups") {
        for (const player of ["Gab", "Manu", "Sean", "Alex"]) {
          await page.getByRole("checkbox", { name: new RegExp(`^${player}`) }).check();
        }
        await page.getByLabel("Parcours").selectOption({ label: "Bethpage Black / Red" });
        await expect(page.getByTestId("strokes-holes")).toHaveCount(3);
      }
      await page.evaluate(() => document.fonts.ready);
      await expectNoSideScroll(page, path({ roundId, importId }));
    });
  }
}
