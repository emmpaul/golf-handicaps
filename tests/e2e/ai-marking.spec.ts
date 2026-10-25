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

/** Fond du champ posé sur du blanc, en [r, g, b] 0-255, tel que l'œil le voit. */
const shownRgb = (field: Locator) =>
  field.evaluate((element) => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("Canvas 2D indisponible");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(element).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b];
  });

/**
 * Teinte IA sarcelle : `--color-ai` clair (#018090) à 15 % sur du blanc, soit [217, 236, 238],
 * à 2 près par canal (arrondis du mélange `color-mix` et du canevas). Le gris des cases en lecture
 * seule (#E8EEF3, [232, 238, 243]) et l'ardoise « au-dessus du par » (#46566E à 15 %,
 * [227, 229, 233]) en sont loin sur le rouge.
 * Mutation : `AI_CELL_CLASS` vidé dans `score-grid.tsx` (plus de `bg-ai/15`) → blanc, rouge.
 */
async function expectAiTint(field: Locator) {
  const shown = await shownRgb(field);
  const expected = [217, 236, 238];
  expect(
    shown.map((channel, index) => Math.abs(channel - expected[index]) <= 2),
    `fond affiché ${shown.join(", ")}`,
  ).toEqual([true, true, true]);
}

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

test("la case remplie par l'IA a un fond sarcelle, distinct du gris des cases en lecture seule", async ({
  page,
}) => {
  await openAiImport(page, ["player0:9"]);
  const gab9 = cell(page, "Ligne 1", 9);
  await expectAiTint(gab9);
  expect(await background(gab9)).not.toBe(await background(cell(page, "Ligne 1", "OUT")));
});

test("le champ Tees rempli par l'IA a le même fond sarcelle", async ({ page }) => {
  await openAiImport(page, ["tees"]);
  await expectAiTint(page.getByLabel("Tees"));
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
