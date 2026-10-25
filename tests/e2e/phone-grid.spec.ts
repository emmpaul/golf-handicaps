import { fourPlayerDraft, seedPlayer, seedReadyImport } from "./data";
import { cell } from "./editor";
import { expect, expectNoSideScroll, test } from "./fixtures";

// Spec `scorecard-import` « Grille de correction sur téléphone » (design D9) : sous 768 px, une
// ligne par trou, les noms des lignes en tête collante, mêmes cases qu'en grille large.
// Mutation : remettre la grille de 18 colonnes sous 768 px → les trois premiers tests rougissent.

/** Les cases du trou 1 sur la carte à 4 lignes : par, index, puis une par ligne de joueur. */
const HOLE_1 = ["Par", "Index", "Ligne 1", "Ligne 2", "Ligne 3", "Ligne 4"];

test("à 320 px, par, index et les 4 scores du trou 1 sont sur une même ligne", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/imports/${seedReadyImport(fourPlayerDraft())}`);
  await expect(page.getByLabel("Joueur de la ligne 4")).toBeVisible();
  const tops: number[] = [];
  for (const row of HOLE_1) {
    const box = await cell(page, row, 1).boundingBox();
    if (!box) throw new Error(`Case ${row} trou 1 absente`);
    expect(box.x + box.width, `${row} trou 1 dans l'écran`).toBeLessThanOrEqual(320);
    tops.push(box.y);
  }
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  await expectNoSideScroll(page);
});

test("à 390 px, au trou 18, la rangée des noms est en haut de la fenêtre", async ({ page }) => {
  seedPlayer("Alex");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/imports/${seedReadyImport(fourPlayerDraft())}`);
  await cell(page, "Ligne 1", 18).scrollIntoViewIfNeeded();
  for (const name of ["Gab", "Manu", "Sean", "Alex"]) {
    const header = page.getByRole("columnheader", { name, exact: true });
    const box = await header.boundingBox();
    if (!box) throw new Error(`En-tête ${name} absent`);
    // Visible, et pas sous l'en-tête collé de l'app : le point au centre est bien l'en-tête.
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.closest("th")?.textContent ?? null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit, name).toBe(name);
  }
});

test("la case « Ligne 1 trou 9 » saisie à 390 px garde sa valeur et son contrôle à 1440 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/imports/${seedReadyImport()}`);
  await expect(page.getByRole("columnheader", { name: "TOT", exact: true })).toHaveCount(0);
  await cell(page, "Ligne 1", 9).fill("3");
  await expect(cell(page, "Ligne 1", 9)).toHaveAttribute("aria-invalid", "true");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("columnheader", { name: "TOT", exact: true })).toHaveCount(1);
  await expect(cell(page, "Ligne 1", 9)).toHaveValue("3");
  await expect(cell(page, "Ligne 1", 9)).toHaveAttribute("aria-invalid", "true");
});

// Tâche 5.2 (revue de finition) : la tête de la première colonne nomme aussi la case de distance
// posée sous le numéro du trou, et les têtes « Dist. », « Par », « Index » et les noms des
// joueurs partagent une ligne de base. Mutations : tête « Trou » seule → « Dist. » introuvable,
// rouge ; petites têtes en `leading-4` (la ligne de 16 px de `text-xs`) → 2 px d'écart, rouge.
test("à 320 px, la tête de la grille nomme la distance et ses têtes partagent une ligne de base", async ({
  page,
}) => {
  seedPlayer("Alex");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/imports/${seedReadyImport(fourPlayerDraft())}`);
  const grid = page.getByRole("region", { name: "Carte à corriger" });
  const heads = grid.getByRole("columnheader");
  // Mesures sur les polices du thème, pas sur leur repli.
  await page.evaluate(() => document.fonts.ready);
  await expect(heads).toHaveText(["Trou Dist.", "Par", "Index", "Gab", "Manu", "Sean", "Alex"]);
  await expect(heads.first().getByTitle("Distance")).toHaveText("Dist.");
  // Ligne de base de la dernière ligne de chaque tête : bas d'un bloc en ligne vide posé dessus.
  const baselines = await heads.evaluateAll((elements) =>
    elements.map((element) => {
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0";
      (element.lastElementChild ?? element).appendChild(probe);
      const y = probe.getBoundingClientRect().bottom;
      probe.remove();
      return Math.round(y);
    }),
  );
  expect(new Set(baselines).size, `lignes de base ${baselines.join(", ")}`).toBe(1);
});
