import { request as playwrightRequest } from "@playwright/test";
import { referenceRound, seedFailedImport, seedReadyImport, seedRound } from "./data";
import { cell, saveButton } from "./editor";
import { expect, test } from "./fixtures";
import { openReferenceCorrection } from "./import";

const leaderboardRows = (page: import("@playwright/test").Page) =>
  page.getByRole("table", { name: "Classement net" }).getByRole("row");

test("la liste va du plus récent au plus ancien et montre le gagnant net", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players, { playedOn: "2026-10-10" }));
  seedRound(referenceRound(players, { playedOn: "2026-10-17" }));
  await page.goto("/rounds");
  const items = page.getByRole("list", { name: "Rounds" }).getByRole("listitem");
  await expect(items.locator("time")).toHaveText(["17 octobre 2026", "10 octobre 2026"]);
  await expect(items.getByTestId("round-winner")).toHaveText([
    "Gagnant net : Gab, Manu",
    "Gagnant net : —",
  ]);
});

test("le détail montre le classement net et la photo servie par une route authentifiée", async ({
  page,
  players,
  baseURL,
}) => {
  test.setTimeout(90_000);
  seedRound(referenceRound(players, { playedOn: "2026-10-10" }));
  await openReferenceCorrection(page);
  await saveButton(page).click();
  await page.waitForURL("**/rounds");
  await page.getByRole("link", { name: /17 octobre 2026/ }).click();
  await page.waitForURL("**/rounds/2");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("BETHPAGE BLACK");
  await expect(page.getByTestId("round-summary")).toHaveText("Tees Red · 17 octobre 2026 · Par 71");
  await expect(leaderboardRows(page)).toHaveText([
    "JoueurBrutHcp de jeuNetRang",
    "Gab721711",
    "Manu8817711",
  ]);
  const photo = page.getByRole("img", { name: "Carte du round" });
  expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3000);
  await expect(photo).toHaveAttribute("src", "/api/rounds/2/photo");

  const anonymous = await playwrightRequest.newContext({ baseURL });
  expect((await anonymous.get("/api/rounds/2/photo")).status()).toBe(401);
  await anonymous.dispose();
});

test("un joueur sans index n'a ni net ni rang : « — » et « pas encore d'index »", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  await expect(leaderboardRows(page)).toHaveText([
    "JoueurBrutHcp de jeuNetRang",
    "Gab72—— pas encore d'index—",
    "Manu88—— pas encore d'index—",
  ]);
});

test("corriger le score de Manu au trou 1 de 7 à 6 donne un brut de 87", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.waitForURL(`**/rounds/${id}/edit`);
  await expect(cell(page, "Ligne 2", 1)).toHaveValue("7");
  await cell(page, "Ligne 2", 1).fill("6");
  await saveButton(page).click();
  await page.waitForURL(`**/rounds/${id}`);
  await expect(leaderboardRows(page).nth(2)).toContainText("Manu87");
});

test("la suppression demande confirmation : annuler garde le round, confirmer le retire", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Supprimer ce round ?" });
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/rounds");
  await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(1);

  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  await dialog.getByRole("button", { name: "Supprimer" }).click();
  await page.waitForURL("**/rounds");
  await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("Aucun round enregistré")).toBeVisible();
});

// Mutation : description du dialogue d'avant, ou import gardé (il revient « Prêt à vérifier »).
test("supprimer un round importé retire aussi son import de la liste des imports", async ({
  page,
  players,
}) => {
  const importId = seedReadyImport();
  const id = seedRound(referenceRound(players), { importId });
  const otherId = seedFailedImport();
  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Supprimer ce round ?" });
  await expect(dialog.getByText(/^Il sera retiré/)).toHaveText(
    "Il sera retiré de l'historique, avec sa photo et son import, et les index de ses joueurs seront recalculés.",
  );
  await dialog.getByRole("button", { name: "Supprimer" }).click();
  await page.waitForURL("**/rounds");

  await page.goto("/import");
  await expect(
    page.getByRole("list", { name: "Imports" }).getByRole("heading", { level: 3 }),
  ).toHaveText([`Import n°${otherId}`]);
});
