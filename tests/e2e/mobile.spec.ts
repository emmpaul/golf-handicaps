import type { Locator, Page } from "@playwright/test";
import { seedReadyImport } from "./data";
import { expect, test } from "./fixtures";
import { choosePhoto, HANDLE_NAMES } from "./import";

/** Tâche 8.9 : projet WebKit iPhone uniquement (voir playwright.config.ts). */

const MIN_TOUCH_TARGET = 44;

async function expectNoHorizontalScroll(page: Page) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.viewport);
}

async function center(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Élément absent");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Glisse une poignée au doigt : pointer events de type `touch`. */
async function touchDrag(handle: Locator, dx: number, dy: number) {
  const start = await center(handle);
  const event = (x: number, y: number) => ({
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true,
    clientX: x,
    clientY: y,
  });
  await handle.dispatchEvent("pointerdown", event(start.x, start.y));
  await handle.dispatchEvent("pointermove", event(start.x + dx / 2, start.y + dy / 2));
  await handle.dispatchEvent("pointermove", event(start.x + dx, start.y + dy));
  await handle.dispatchEvent("pointerup", event(start.x + dx, start.y + dy));
}

test("import sur iPhone : pas de défilement horizontal, poignées de 44 px déplaçables au doigt", async ({
  page,
}) => {
  await page.goto("/import");
  await expectNoHorizontalScroll(page);
  await choosePhoto(page);
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  for (const name of Object.values(HANDLE_NAMES)) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }

  const handle = page.getByRole("button", { name: "Coin haut gauche" });
  const before = await center(handle);
  await touchDrag(handle, 30, 20);
  const after = await center(handle);
  expect(after.x - before.x).toBeCloseTo(30, 0);
  expect(after.y - before.y).toBeCloseTo(20, 0);
});

test("correction sur iPhone : pas de défilement horizontal, la grille défile seule", async ({
  page,
}) => {
  const id = seedReadyImport();
  await page.goto(`/imports/${id}`);
  await expect(page.getByLabel("Parcours", { exact: true })).toHaveValue("BETHPAGE BLACK");
  await expectNoHorizontalScroll(page);

  const grid = page.getByRole("table");
  const scroller = grid.locator("xpath=..");
  const overflow = await scroller.evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(true);
  const cell = page.getByRole("textbox", { name: "Ligne 1 trou 18", exact: true });
  await cell.fill("4");
  await expect(cell).toHaveValue("4");
  await expectNoHorizontalScroll(page);
});
