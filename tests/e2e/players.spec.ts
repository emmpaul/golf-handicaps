import type { Page } from "@playwright/test";
import { saveButton } from "./editor";
import { expect, OCR_SHARD, test } from "./fixtures";
import { openReferenceCorrection } from "./import";

// Enfants directs seulement : chaque joueur contient aussi la liste de ses alias.
const playerItems = (page: Page) =>
  page.getByRole("list", { name: "Joueurs" }).locator(":scope > li");
const playerItem = (page: Page, name: string) =>
  playerItems(page).filter({ has: page.getByRole("heading", { name, exact: true }) });
const aliasNames = (page: Page, name: string) =>
  playerItem(page, name).getByTestId("player-aliases").getByRole("listitem").getByTestId("alias");

test("sur une base neuve, la page joueurs liste Gab, Manu et Sean avec leurs alias", async ({
  page,
}) => {
  await page.goto("/players");
  await expect(playerItems(page).getByRole("heading")).toHaveText(["Gab", "Manu", "Sean"]);
  await expect(aliasNames(page, "Gab")).toHaveText(["GAB"]);
  await expect(aliasNames(page, "Manu")).toHaveText(["MANU"]);
  await expect(aliasNames(page, "Sean")).toHaveText(["SEAN"]);
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
  await expect(aliasNames(page, "Sean")).toHaveText(["SEAN", "SEANP"]);
});

test("retirer « SEANP » de Sean le retire de la liste ; sans alias, Sean affiche « — »", async ({
  page,
}) => {
  await page.goto("/players");
  await page.getByLabel("Nouvel alias de Sean").fill("SEANP");
  await playerItem(page, "Sean").getByRole("button", { name: "Ajouter l'alias" }).click();
  await expect(aliasNames(page, "Sean")).toHaveText(["SEAN", "SEANP"]);

  await page.getByRole("button", { name: "Retirer l'alias SEANP de Sean" }).click();
  await expect(aliasNames(page, "Sean")).toHaveText(["SEAN"]);

  await page.getByRole("button", { name: "Retirer l'alias SEAN de Sean" }).click();
  await expect(playerItem(page, "Sean").getByTestId("player-aliases")).toHaveText("Alias : —");
  await expect(aliasNames(page, "Manu")).toHaveText(["MANU"]);
});

test.describe("sans JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("« Retirer » retire l'alias GAB de Gab", async ({ page }) => {
    await page.goto("/players");
    await page.getByRole("button", { name: "Retirer l'alias GAB de Gab" }).click();
    await expect(playerItem(page, "Gab").getByTestId("player-aliases")).toHaveText("Alias : —");
  });
});

test(
  "associer à la main la ligne « GAB » à Alex mémorise l'alias GAB pour Alex",
  OCR_SHARD,
  async ({ page }) => {
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
    await expect(aliasNames(page, "Alex")).toHaveText(["GAB"]);
    await expect(playerItem(page, "Gab").getByTestId("player-aliases")).toHaveText("Alias : —");
  },
);

test(
  "alias réappris : « GAB » retiré de Gab, puis la ligne « GAB » associée à Sean",
  OCR_SHARD,
  async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/players");
    await page.getByRole("button", { name: "Retirer l'alias GAB de Gab" }).click();
    await expect(playerItem(page, "Gab").getByTestId("player-aliases")).toHaveText("Alias : —");

    await openReferenceCorrection(page);
    await page.getByLabel("Joueur de la ligne 1").selectOption({ label: "Sean" });
    await saveButton(page).click();
    await page.waitForURL("**/rounds");

    await page.goto("/players");
    await expect(aliasNames(page, "Sean")).toHaveText(["GAB", "SEAN"]);
    await expect(playerItem(page, "Gab").getByTestId("player-aliases")).toHaveText("Alias : —");
  },
);
