import type { Page } from "@playwright/test";

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
