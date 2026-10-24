import { referenceRound, seedReadyImport, seedRound } from "./data";
import { expect, test } from "./fixtures";

test.use({ viewport: { width: 1440, height: 900 } });

/** max-w-7xl = 80rem = 1280 px : même largeur de contenu sur toutes les pages, nav comprise. */
const CONTENT_WIDTH = 1280;

test("à 1440×900, <main> et la navigation ont la même largeur sur toutes les pages", async ({
  page,
  players,
}) => {
  const roundId = seedRound(referenceRound(players));
  const importId = seedReadyImport();
  const widths: Record<string, [number, number]> = {};
  for (const path of [
    "/",
    "/rounds",
    `/rounds/${roundId}`,
    "/players",
    "/handicaps",
    "/strokes",
    "/import",
    `/imports/${importId}`,
  ]) {
    await page.goto(path);
    const main = await page.getByRole("main").boundingBox();
    const nav = await page.getByRole("navigation", { name: "Navigation principale" }).boundingBox();
    widths[path] = [Math.round(main?.width ?? 0), Math.round(nav?.width ?? 0)];
  }
  expect(widths).toEqual({
    "/": [CONTENT_WIDTH, CONTENT_WIDTH],
    "/rounds": [CONTENT_WIDTH, CONTENT_WIDTH],
    [`/rounds/${roundId}`]: [CONTENT_WIDTH, CONTENT_WIDTH],
    "/players": [CONTENT_WIDTH, CONTENT_WIDTH],
    "/handicaps": [CONTENT_WIDTH, CONTENT_WIDTH],
    "/strokes": [CONTENT_WIDTH, CONTENT_WIDTH],
    "/import": [CONTENT_WIDTH, CONTENT_WIDTH],
    [`/imports/${importId}`]: [CONTENT_WIDTH, CONTENT_WIDTH],
  });
});

test.describe("mobile review", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const width of [320, 390]) {
    for (const colorScheme of ["light", "dark"] as const) {
      test(`${width}px ${colorScheme}: every page fits, with mobile review captures`, async ({
        page,
        players,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ colorScheme });
        seedRound(referenceRound(players, { playedOn: "2026-10-01" }));
        const roundId = seedRound(referenceRound(players));
        const importId = seedReadyImport();
        const pages = [
          ["home", "/"],
          ["import", "/import"],
          ["correction", `/imports/${importId}`],
          ["rounds", "/rounds"],
          ["round", `/rounds/${roundId}`],
          ["handicaps", "/handicaps"],
          ["strokes", "/strokes"],
          ["players", "/players"],
          ["courses", "/courses"],
        ];
        for (const [name, path] of pages) {
          await page.setViewportSize({ width, height: 844 });
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          if (name === "strokes") {
            await page.getByRole("checkbox", { name: /^Gab/ }).check();
            await page.getByRole("checkbox", { name: /^Manu/ }).check();
            await page.getByLabel("Parcours").selectOption({ label: "Bethpage Black / Red" });
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            path,
          ).toBe(true);
          if (width === 390) {
            await page.evaluate(() => document.fonts.ready);
            // A tall viewport puts fixed bars below the content in a full-page review image.
            // Layout assertions above still run at the phone's 844px viewport height.
            const height = await page.evaluate(() => document.documentElement.scrollHeight);
            await page.setViewportSize({ width, height });
            const screenshot = testInfo.outputPath(`${name}-${colorScheme}.png`);
            await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
            await testInfo.attach(`${name}-${colorScheme}`, {
              path: screenshot,
              contentType: "image/png",
            });
          }
        }
      });
    }
  }
});
