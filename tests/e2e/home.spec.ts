import packageJson from "../../package.json";
import { referenceRound, seedRound } from "./data";
import { expect, test } from "./fixtures";
import { openReferenceCorrection } from "./import";
import { authenticate } from "./session";

test("la page d'accueil affiche le titre de l'app en français", async ({
  page,
  context,
  baseURL,
}) => {
  await authenticate(context, baseURL);
  await page.goto("/");
  await expect(page).toHaveTitle("Handicaps golf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Handicaps golf");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("la page d'accueil montre la version seule en pied de page (build e2e sans commit)", async ({
  page,
  context,
  baseURL,
}) => {
  await authenticate(context, baseURL);
  await page.goto("/");
  // La release change la version de `package.json` : le texte attendu la suit. Nom exact :
  // un « · <commit> » ne correspondrait pas.
  const version = page.getByRole("link", { name: `v${packageJson.version}`, exact: true });
  await expect(version).toHaveAttribute(
    "href",
    `https://github.com/emmpaul/golf-handicaps/releases/tag/v${packageJson.version}`,
  );
});

test("dashboard indexes, previous-round deltas, latest round and import action", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players, { playedOn: "2026-10-01" }));
  const latest = seedRound(referenceRound(players, { playedOn: "2026-10-17" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("list", { name: "Sections" })).toHaveCount(0);
  await expect(main).not.toContainText("Index simulateur et son évolution.");
  const gab = main.locator(`a[href="/handicaps?joueur=${players.Gab}"]`);
  const manu = main.locator(`a[href="/handicaps?joueur=${players.Manu}"]`);
  const sean = main.locator(`a[href="/handicaps?joueur=${players.Sean}"]`);
  await expect(gab).toContainText("1,0");
  await expect(gab).toContainText("=");
  await expect(manu).toContainText("17,0");
  await expect(manu).toContainText("=");
  await expect(manu).toContainText("provisoire");
  await expect(sean).toContainText("pas encore d'index");
  const round = main.locator(`a[href="/rounds/${latest}"]`);
  for (const text of [
    "Bethpage Black · Red",
    "17 octobre 2026",
    "Gab 72",
    "Manu 88",
    "Gagnant net : Gab, Manu",
  ])
    await expect(round).toContainText(text);
  await expect(main.getByRole("link", { name: /import.*à vérifier/ })).toHaveCount(0);
  await main.getByRole("link", { name: "Importer une carte" }).click();
  await expect(page).toHaveURL(/\/import$/);
});

test("dashboard shows the empty round state and links a ready import", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Aucun round enregistré")).toBeVisible();
  test.setTimeout(90_000);
  const id = await openReferenceCorrection(page);
  await page.goto("/");
  await page.getByRole("link", { name: "1 import à vérifier", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/imports/${id}$`));
});
