import type { Locator, Page } from "@playwright/test";
import { seedReadyImport } from "./data";
import { cell } from "./editor";
import { expect, test } from "./fixtures";

const AI_DESCRIPTION = "complété par l'IA";
const AI_NOTE = "Complétion IA indisponible";

/** Ouvre la correction d'un import de la carte de référence dont l'IA a rempli `aiCells`. */
async function openAiImport(page: Page, aiCells: string[]) {
  await page.goto(`/imports/${seedReadyImport(undefined, { aiCells, aiNote: AI_NOTE })}`);
}

const marked = (page: Page) => page.locator(`[aria-description="${AI_DESCRIPTION}"]`);
const marks = (page: Page) => page.getByTestId("ai-mark");
const background = (field: Locator) =>
  field.evaluate((element) => getComputedStyle(element).backgroundColor);

test("la case remplie par l'IA porte la marque visible et la description, elle seule", async ({
  page,
}) => {
  await openAiImport(page, ["player0:9"]);
  const gab9 = cell(page, "Ligne 1", 9);
  await expect(gab9).toHaveAccessibleDescription(AI_DESCRIPTION);
  await expect(marked(page)).toHaveCount(1);
  await expect(marks(page)).toHaveCount(1);
  await expect(page.getByRole("cell").filter({ has: gab9 }).getByTestId("ai-mark")).toBeVisible();
  expect(await background(gab9)).not.toBe(await background(cell(page, "Ligne 1", 8)));
});

test("la note de l'IA s'affiche au-dessus de la grille", async ({ page }) => {
  await openAiImport(page, ["player0:9"]);
  const note = page.getByRole("alert").filter({ hasText: AI_NOTE });
  await expect(note).toBeVisible();
  const noteBox = await note.boundingBox();
  const gridBox = await page.getByRole("table").boundingBox();
  if (!noteBox || !gridBox) throw new Error("Note ou grille absente");
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(gridBox.y);
});

test("une case marquée puis modifiée perd la marque", async ({ page }) => {
  await openAiImport(page, ["player0:9"]);
  const gab9 = cell(page, "Ligne 1", 9);
  await expect(gab9).toHaveAccessibleDescription(AI_DESCRIPTION);
  await gab9.fill("4");
  await expect(gab9).not.toHaveAttribute("aria-description");
  await expect(marked(page)).toHaveCount(0);
  await expect(marks(page)).toHaveCount(0);
});

test("le champ Tees rempli par l'IA est marqué, puis plus après modification", async ({ page }) => {
  await openAiImport(page, ["tees"]);
  const tees = page.getByLabel("Tees");
  await expect(tees).toHaveAccessibleDescription(AI_DESCRIPTION);
  await expect(marks(page)).toHaveCount(1);
  await tees.fill("Blue");
  await expect(tees).not.toHaveAttribute("aria-description");
  await expect(marks(page)).toHaveCount(0);
});
