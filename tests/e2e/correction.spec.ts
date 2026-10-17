import { seedReadyImport } from "./data";
import { cell, fillRow, rowValues, saveButton } from "./editor";
import { expect, test } from "./fixtures";
import { openReferenceCorrection } from "./import";

const REFERENCE_PARS = ["4", "4", "3", "5", "4", "4", "5", "3", "4"].concat([
  "4",
  "4",
  "4",
  "5",
  "3",
  "4",
  "4",
  "3",
  "4",
]);

test("l'écran de correction de la photo de référence est pré-rempli, photo visible", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openReferenceCorrection(page);
  await expect(page.getByLabel("Parcours", { exact: true })).toHaveValue("BETHPAGE BLACK");
  await expect(page.getByLabel("Tees")).toHaveValue("Red");
  await expect(page.getByLabel("Date")).toHaveText("17 octobre 2026");
  expect(await rowValues(page, "Par")).toEqual(REFERENCE_PARS);
  await expect(page.getByLabel("Joueur de la ligne 1")).toHaveValue(/^\d+$/);
  await expect(page.getByLabel("Joueur de la ligne 1").locator("option:checked")).toHaveText("Gab");
  await expect(page.getByLabel("Joueur de la ligne 2").locator("option:checked")).toHaveText(
    "Manu",
  );
  const photo = page.getByRole("img", { name: "Carte importée" });
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3000);
  await expect(saveButton(page)).toHaveText("Enregistrer");
});

test("une valeur fausse est surlignée et comptée, puis la correction l'efface", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openReferenceCorrection(page);
  await cell(page, "Ligne 1", 9).fill("3");
  await expect(page.getByText("Somme aller 36 ≠ OUT 38")).toBeVisible();
  await expect(saveButton(page)).toHaveText("1 problème à corriger");
  await expect(saveButton(page)).toBeDisabled();
  await expect(cell(page, "Ligne 1", 9)).toHaveAttribute("aria-invalid", "true");
  await expect(cell(page, "Ligne 1", "OUT")).toHaveAttribute("aria-invalid", "true");

  await cell(page, "Ligne 1", 9).fill("5");
  await expect(page.getByText("Somme aller 36 ≠ OUT 38")).toHaveCount(0);
  await expect(cell(page, "Ligne 1", 9)).not.toHaveAttribute("aria-invalid", "true");
  await expect(saveButton(page)).toHaveText("Enregistrer");
});

test("une ligne ajoutée pour Sean s'enregistre et le round apparaît dans la liste", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openReferenceCorrection(page);
  await page.getByRole("button", { name: "Ajouter une ligne" }).click();
  await expect(saveButton(page)).toHaveText("19 problèmes à corriger");
  await page.getByLabel("Joueur de la ligne 3").selectOption({ label: "Sean" });
  await fillRow(page, "Ligne 3", Array(18).fill(5));
  await expect(cell(page, "Ligne 3", "TOT")).toHaveValue("90");
  await saveButton(page).click();

  await page.waitForURL("**/rounds");
  const round = page.getByRole("listitem").filter({ hasText: "BETHPAGE BLACK" });
  await expect(round).toHaveCount(1);
  await expect(round.getByTestId("round-gross")).toHaveText(["Gab 72", "Manu 88", "Sean 90"]);
});

test("les lignes de la grille portent le nom du joueur associé, sinon le nom lu", async ({
  page,
}) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  const headers = page.getByRole("table").getByRole("rowheader");
  await expect(headers).toHaveText(["Par", "Index", "Distance", "Gab", "Manu"]);
  await page.getByLabel("Joueur de la ligne 2").selectOption({ label: "Choisir un joueur" });
  await expect(headers).toHaveText(["Par", "Index", "Distance", "Gab", "MANU ?"]);
  await page.getByRole("button", { name: "Ajouter une ligne" }).click();
  await expect(headers).toHaveText(["Par", "Index", "Distance", "Gab", "MANU ?", "Ligne 3"]);
  await expect(cell(page, "Ligne 1", 9)).toHaveValue("5");
});
