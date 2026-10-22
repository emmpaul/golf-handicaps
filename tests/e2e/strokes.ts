import type { Page } from "@playwright/test";

/** Ouvre la page Coups, coche Gab et Manu et choisit le parcours « Bethpage Black / Red ». */
export async function planGabAndManuOnBethpage(page: Page) {
  await page.goto("/strokes");
  await page.getByRole("checkbox", { name: /^Gab/ }).check();
  await page.getByRole("checkbox", { name: /^Manu/ }).check();
  await page.getByLabel("Parcours").selectOption({ label: "Bethpage Black / Red" });
}
