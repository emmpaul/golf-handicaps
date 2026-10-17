import { expect, type Page } from "@playwright/test";
import { formatPlayedOn } from "../../src/lib/format";

/** Case de la grille de l'écran de correction : `Par trou 4`, `Ligne 1 OUT`… */
export const cell = (page: Page, row: string, column: number | "OUT" | "IN" | "TOT") =>
  page.getByRole("textbox", {
    name: typeof column === "number" ? `${row} trou ${column}` : `${row} ${column}`,
    exact: true,
  });

/** Valeurs des 18 cases d'une ligne de la grille. */
export async function rowValues(page: Page, row: string): Promise<string[]> {
  const values: string[] = [];
  for (let hole = 1; hole <= 18; hole++) values.push(await cell(page, row, hole).inputValue());
  return values;
}

/** Saisit 18 valeurs dans une ligne de la grille. */
export async function fillRow(page: Page, row: string, values: readonly number[]) {
  for (const [i, value] of values.entries()) await cell(page, row, i + 1).fill(String(value));
}

export const saveButton = (page: Page) =>
  page.getByRole("button", { name: /^(Enregistrer|\d+ problèmes? à corriger)$/ });

/**
 * Choisit la date `iso` (« 2026-10-17 ») dans le calendrier du champ « Date » : mois et année
 * dans les listes, puis le jour, dont le nom accessible contient « 17 octobre 2026 ».
 */
export async function pickDate(page: Page, iso: string) {
  const [year, month] = iso.split("-").map(Number);
  await page.getByLabel("Date").click();
  await page.getByLabel("Choisir le mois").selectOption(String(month - 1));
  await page.getByLabel("Choisir l'année").selectOption(String(year));
  // L'espace devant exclut le 14 quand on cherche le 4.
  const day = new RegExp(` ${formatPlayedOn(iso)}(,|$)`);
  await page.getByRole("grid").getByRole("button", { name: day }).click();
  // Le calendrier ouvert a sa propre région `status` (le mois affiché) : on attend qu'il parte.
  await expect(page.getByRole("grid")).toHaveCount(0);
}
