import { seedReadyImport } from "./data";
import { saveButton } from "./editor";
import { expect, test } from "./fixtures";

/**
 * Sur ordinateur, la grille de l'écran de correction tient en entier : ni défilement
 * horizontal dans la grille ni dans la page, la colonne TOT est visible.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
]) {
  test.describe(`${viewport.width}×${viewport.height}`, () => {
    test.use({ viewport });

    test("la grille de correction tient sans défilement horizontal", async ({ page }) => {
      const id = seedReadyImport();
      await page.goto(`/imports/${id}`);
      await expect(page.getByLabel("Parcours", { exact: true })).toHaveValue("BETHPAGE BLACK");

      const scroller = page.getByRole("table").locator("xpath=..");
      const grid = await scroller.evaluate((element) => ({
        scroll: element.scrollWidth,
        client: element.clientWidth,
      }));
      expect(grid.scroll).toBeLessThanOrEqual(grid.client);

      const pageScroll = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(pageScroll).toBeLessThanOrEqual(viewport.width);

      const total = await page
        .getByRole("columnheader", { name: "TOT", exact: true })
        .boundingBox();
      expect(total).not.toBeNull();
      expect((total?.x ?? Number.POSITIVE_INFINITY) + (total?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width,
      );
    });
  });
}

test.describe("1440×900, barre d'enregistrement", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("la barre collante d'enregistrement passe devant les en-têtes de ligne de la grille", async ({
    page,
  }) => {
    const id = seedReadyImport();
    await page.goto(`/imports/${id}`);
    await expect(saveButton(page)).toHaveText("Enregistrer");
    const box = await saveButton(page).boundingBox();
    if (!box) throw new Error("Bouton absent");
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("button")?.textContent ?? null,
      { x: box.x + 8, y: box.y + box.height / 2 },
    );
    expect(hit).toBe("Enregistrer");
  });
});

test.describe("1440×900, sans défilement vertical", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("la dernière ligne de joueur de la grille est visible au-dessus de la barre d'enregistrement", async ({
    page,
  }) => {
    const id = seedReadyImport();
    await page.goto(`/imports/${id}`);
    await expect(saveButton(page)).toHaveText("Enregistrer");
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    const lastTotal = await page
      .getByRole("textbox", { name: "Ligne 2 TOT", exact: true })
      .boundingBox();
    const bar = await saveButton(page).locator("xpath=..").boundingBox();
    if (!lastTotal || !bar) throw new Error("Case TOT ou barre absente");
    const bottom = lastTotal.y + lastTotal.height;
    expect(bottom).toBeLessThanOrEqual(bar.y);
    expect(bottom).toBeLessThanOrEqual(900);
  });
});
