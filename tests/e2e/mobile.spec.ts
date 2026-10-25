import type { Locator } from "@playwright/test";
import { referenceRound, seedFailedImport, seedReadyImport, seedRound } from "./data";
import { expect, expectNoHorizontalScroll, expectNoSideScroll, test } from "./fixtures";
import { HANDLE_NAMES } from "./import";

/** Tâche 8.9 : projet WebKit iPhone uniquement (voir playwright.config.ts). */

const MIN_TOUCH_TARGET = 44;

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

test("recadrage sur iPhone : pas de défilement horizontal, poignées de 44 px déplaçables au doigt", async ({
  page,
}) => {
  await page.goto("/import");
  await expectNoHorizontalScroll(page);
  await page.goto(`/imports/${seedFailedImport()}/recadrer`);
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

// Spec `app-shell` « Pas de défilement horizontal de la page » (modifiée) : sous 768 px, la grille
// ne défile plus dans son cadre, elle passe à une ligne par trou.
test("correction sur iPhone : ni la page ni la grille ne défilent de côté", async ({ page }) => {
  const id = seedReadyImport();
  await page.goto(`/imports/${id}`);
  await expect(page.getByLabel("Parcours", { exact: true })).toHaveValue("BETHPAGE BLACK");
  await expectNoSideScroll(page);

  const cell = page.getByRole("textbox", { name: "Ligne 1 trou 18", exact: true });
  await cell.fill("4");
  await expect(cell).toHaveValue("4");
  await expectNoSideScroll(page);
});

test("liste des imports à 375 px : « Supprimer » ne fait pas déborder la ligne d'un import en échec", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const id = seedFailedImport();
  await page.goto("/import");
  const row = page
    .getByRole("list", { name: "Imports" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `Import n°${id}` }) });
  await expect(row.getByRole("button", { name: "Supprimer", exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("rounds à 390 px, en bas de page : la ligne de version finit au-dessus de la barre « Sections »", async ({
  page,
  players,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Six rounds : la liste dépasse l'écran, la page défile.
  for (const day of [1, 2, 3, 4, 5, 6]) {
    seedRound(referenceRound(players, { playedOn: `2026-10-0${day}` }));
  }
  await page.goto("/rounds");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const version = await page.getByRole("link", { name: /^v\d+\.\d+\.\d+/ }).boundingBox();
  const bar = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
  if (!version || !bar) throw new Error("Ligne de version ou barre « Sections » absente");
  expect(version.y + version.height).toBeLessThanOrEqual(bar.y);
  await expectNoHorizontalScroll(page);
});

test("accueil à 390 px, en bas de page : « Se déconnecter » fait 44 px et finit au-dessus de la barre « Sections »", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  // Mutation : `size="sm"` (28 px) fait rougir la hauteur ; un bouton `fixed bottom-0`, la position.
  const logout = await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .boundingBox();
  const bar = await page.getByRole("navigation", { name: "Sections" }).boundingBox();
  if (!logout || !bar) throw new Error("Bouton « Se déconnecter » ou barre « Sections » absent");
  expect(logout.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  expect(logout.y + logout.height).toBeLessThanOrEqual(bar.y);
  await expectNoHorizontalScroll(page);
});

for (const width of [390, 320]) {
  test(`editor player rows stay together at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/imports/${seedReadyImport()}`);
    for (const n of [1, 2]) {
      const select = await page.getByLabel(`Joueur de la ligne ${n}`).boundingBox();
      if (!select) throw new Error("Missing select bounds");
      const remove = await page
        .getByRole("button", { name: `Retirer la ligne ${n}` })
        .boundingBox();
      if (!remove) throw new Error("Missing remove bounds");
      expect(select).not.toBeNull();
      expect(remove).not.toBeNull();
      expect(Math.abs(select.y - remove.y)).toBeLessThanOrEqual(2);
    }
    await expectNoHorizontalScroll(page);
  });
}

// Spec `app-shell` « Contenu défilant signalé » (modifiée) : le fondu ne sert qu'à partir de 768 px.
test("correction fades follow scrolling at 800px and disappear when all holes fit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(`/imports/${seedReadyImport()}`);
  const frame = page.locator('[data-slot="scroll-frame"]');
  const viewport = frame.locator('[data-slot="scroll-viewport"]');
  await expect(frame).toHaveAttribute("data-overflow-end", "true");
  await expect(frame).not.toHaveAttribute("data-overflow-start");
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(frame).toHaveAttribute("data-overflow-start", "true");
  await expect(frame).not.toHaveAttribute("data-overflow-end");
  const par = await page.getByRole("rowheader", { name: "Par", exact: true }).boundingBox();
  if (!par) throw new Error("Missing par bounds");
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("Missing bounds bounds");
  expect(par.x).toBeGreaterThanOrEqual(bounds.x);
  expect(par.x + par.width).toBeLessThan(bounds.x + bounds.width);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(frame).not.toHaveAttribute("data-overflow-start");
  await expect(frame).not.toHaveAttribute("data-overflow-end");
});

test("alias removal remains a 44px touch target", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/players");
  const buttons = page.getByRole("button", { name: /^Retirer l'alias/ });
  expect(await buttons.count()).toBeGreaterThan(0);
  for (const button of await buttons.all())
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});
