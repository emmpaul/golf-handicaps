import type { Page } from "@playwright/test";
import { saveButton } from "./editor";
import { expect, test } from "./fixtures";
import { openReferenceCorrection } from "./import";

const playerItems = (page: Page) =>
  page.getByRole("list", { name: "Joueurs" }).getByRole("listitem");
const playerItem = (page: Page, name: string) =>
  playerItems(page).filter({ has: page.getByRole("heading", { name, exact: true }) });

test("sur une base neuve, la page joueurs liste Gab, Manu et Sean avec leurs alias", async ({
  page,
}) => {
  await page.goto("/players");
  await expect(playerItems(page).getByRole("heading")).toHaveText(["Gab", "Manu", "Sean"]);
  await expect(playerItems(page).getByTestId("player-aliases")).toHaveText([
    "Alias : GAB",
    "Alias : MANU",
    "Alias : SEAN",
  ]);
});

test("ajouter « Alex » le liste sans index ; « gab » est refusé", async ({ page }) => {
  await page.goto("/players");
  await page.getByLabel("Nouveau joueur").fill("Alex");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(playerItems(page).getByRole("heading")).toHaveText(["Alex", "Gab", "Manu", "Sean"]);
  await expect(playerItem(page, "Alex").getByTestId("player-index")).toHaveText("Index —");

  await page.getByLabel("Nouveau joueur").fill("gab");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Ce joueur existe déjà");
  await expect(playerItems(page)).toHaveCount(4);
});

test("renommer Sean en « Seán » ; renommer en « manu » est refusé", async ({ page }) => {
  await page.goto("/players");
  await page.getByLabel("Nom de Sean").fill("Seán");
  await playerItem(page, "Sean").getByRole("button", { name: "Renommer" }).click();
  await expect(playerItems(page).getByRole("heading")).toHaveText(["Gab", "Manu", "Seán"]);

  await page.getByLabel("Nom de Gab").fill("manu");
  await playerItem(page, "Gab").getByRole("button", { name: "Renommer" }).click();
  await expect(playerItem(page, "Gab").getByRole("alert")).toHaveText("Ce joueur existe déjà");
  await expect(playerItems(page).getByRole("heading")).toHaveText(["Gab", "Manu", "Seán"]);
});

test("ajouter l'alias « SEANP » à Sean l'affiche dans ses alias", async ({ page }) => {
  await page.goto("/players");
  await page.getByLabel("Nouvel alias de Sean").fill("seanp");
  await playerItem(page, "Sean").getByRole("button", { name: "Ajouter l'alias" }).click();
  await expect(playerItem(page, "Sean").getByTestId("player-aliases")).toHaveText(
    "Alias : SEAN, SEANP",
  );
});

test("associer à la main la ligne « GAB » à Alex mémorise l'alias GAB pour Alex", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/players");
  await page.getByLabel("Nouveau joueur").fill("Alex");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(playerItems(page)).toHaveCount(4);

  await openReferenceCorrection(page);
  await page.getByLabel("Joueur de la ligne 1").selectOption({ label: "Alex" });
  await saveButton(page).click();
  await page.waitForURL("**/rounds");

  await page.goto("/players");
  await expect(playerItem(page, "Alex").getByTestId("player-aliases")).toHaveText("Alias : GAB");
  await expect(playerItem(page, "Gab").getByTestId("player-aliases")).toHaveText("Alias : —");
});
