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
