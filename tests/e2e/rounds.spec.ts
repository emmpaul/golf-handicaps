import { request as playwrightRequest } from "@playwright/test";
import {
  fourPlayerRound,
  referenceRound,
  seedFailedImport,
  seedPlayer,
  seedReadyImport,
  seedRound,
} from "./data";
import { cell, saveButton } from "./editor";
import { expect, expectNoSideScroll, OCR_SHARD, test } from "./fixtures";
import { openReferenceCorrection } from "./import";

const leaderboardRows = (page: import("@playwright/test").Page) =>
  page.getByRole("table", { name: "Classement net" }).getByRole("row");

/**
 * Rectangles du texte visible d'un élément (pas de sa case) : un par ligne de chaque nœud texte,
 * en sautant le texte réservé aux lecteurs d'écran (`sr-only`, en position absolue).
 */
const visibleTextRects = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((element) => {
    const rects: { left: number; right: number; top: number }[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!node.textContent?.trim() || !parent) continue;
      if (getComputedStyle(parent).position === "absolute") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const { left, right, top } of range.getClientRects()) rects.push({ left, right, top });
    }
    return rects;
  });

/** Bords gauche et droit du texte visible d'un élément. */
async function textEdges(locator: import("@playwright/test").Locator) {
  const rects = await visibleTextRects(locator);
  return {
    left: Math.min(...rects.map((rect) => rect.left)),
    right: Math.max(...rects.map((rect) => rect.right)),
  };
}

test("la liste va du plus récent au plus ancien et montre le gagnant net", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players, { playedOn: "2026-10-10" }));
  seedRound(referenceRound(players, { playedOn: "2026-10-17" }));
  await page.goto("/rounds");
  const items = page.getByRole("list", { name: "Rounds" }).getByRole("listitem");
  await expect(items.locator("time")).toHaveText(["17 octobre 2026", "10 octobre 2026"]);
  await expect(items.getByTestId("round-winner")).toHaveText([
    "Gagnant net : Gab, Manu",
    "Gagnant net : —",
  ]);
});

// Spec `rounds`, « Ligne de la liste ». Mutation : `{round.courseName} · {round.tees}` remis dans
// un seul élément → « BETHPAGE BLACK » et « Red » introuvables seuls, et « · », rouge.
test("une ligne de la liste montre le parcours et les tees en deux éléments, sans point médian", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players, { courseName: "BETHPAGE BLACK" }));
  await page.goto("/rounds");
  const row = page.getByRole("list", { name: "Rounds" }).getByRole("listitem");
  await expect(row.getByText("BETHPAGE BLACK", { exact: true })).toBeVisible();
  await expect(row.getByText("Red", { exact: true })).toBeVisible();
  await expect(row).not.toContainText("·");
});

test(
  "le détail montre le classement net et la photo servie par une route authentifiée",
  OCR_SHARD,
  async ({ page, players, baseURL }) => {
    test.setTimeout(90_000);
    seedRound(referenceRound(players, { playedOn: "2026-10-10" }));
    await openReferenceCorrection(page);
    await saveButton(page).click();
    await page.waitForURL("**/rounds");
    await page.getByRole("link", { name: /17 octobre 2026/ }).click();
    await page.waitForURL("**/rounds/2");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("BETHPAGE BLACK");
    // Spec `rounds`, « En-tête du round de référence » : trois éléments, sans « · ».
    const summary = page.getByTestId("round-summary");
    for (const element of ["Tees Red", "17 octobre 2026", "Par 71"])
      await expect(summary.getByText(element, { exact: true })).toBeVisible();
    await expect(summary).not.toContainText("·");
    await expect(leaderboardRows(page)).toHaveText([
      "JoueurBrutHcp de jeuNetRang",
      "Gab721711",
      "Manu8817711",
    ]);
    const photo = page.getByRole("img", { name: "Carte du round" });
    expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3000);
    await expect(photo).toHaveAttribute("src", "/api/rounds/2/photo");

    const anonymous = await playwrightRequest.newContext({ baseURL });
    expect((await anonymous.get("/api/rounds/2/photo")).status()).toBe(401);
    await anonymous.dispose();
  },
);

// Spec `rounds`, « Round sans rating » et « Round avec rating » ; spec `course-rating`,
// « Navigation ». Mutation : par en dur, ligne absente ou lien vers une autre page.
test("sans rating confirmée, le round affiche « Sans rating (par 71, slope 113) » et mène aux Parcours", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  const rating = page.getByTestId("round-rating");
  await expect(rating).toHaveText("Sans rating (par 71, slope 113)");
  await rating.click();
  await page.waitForURL("**/courses");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parcours");
});

test("un joueur sans index n'a ni net ni rang : « — » et « pas encore d'index »", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  await expect(leaderboardRows(page)).toHaveText([
    "JoueurBrutHcp de jeuNetRang",
    "Gab pas encore d'index72———",
    "Manu pas encore d'index88———",
  ]);
});

test("corriger le score de Manu au trou 1 de 7 à 6 donne un brut de 87", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  await page.getByRole("link", { name: "Modifier" }).click();
  await page.waitForURL(`**/rounds/${id}/edit`);
  await expect(cell(page, "Ligne 2", 1)).toHaveValue("7");
  await cell(page, "Ligne 2", 1).fill("6");
  await saveButton(page).click();
  await page.waitForURL(`**/rounds/${id}`);
  await expect(leaderboardRows(page).nth(2)).toHaveText("Manu pas encore d'index87———");
});

test("la suppression demande confirmation : annuler garde le round, confirmer le retire", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Supprimer ce round ?" });
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto("/rounds");
  await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(1);

  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  await dialog.getByRole("button", { name: "Supprimer" }).click();
  await page.waitForURL("**/rounds");
  await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByText("Aucun round enregistré")).toBeVisible();
});

// Mutation : description du dialogue d'avant, ou import gardé (il revient « Prêt à vérifier »).
test("supprimer un round importé retire aussi son import de la liste des imports", async ({
  page,
  players,
}) => {
  const importId = seedReadyImport();
  const id = seedRound(referenceRound(players), { importId });
  const otherId = seedFailedImport();
  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Supprimer ce round ?" });
  await expect(dialog.getByText(/^Il sera retiré/)).toHaveText(
    "Il sera retiré de l'historique, avec sa photo et son import, et les index de ses joueurs seront recalculés.",
  );
  await dialog.getByRole("button", { name: "Supprimer" }).click();
  await page.waitForURL("**/rounds");

  await page.goto("/import");
  await expect(
    page.getByRole("list", { name: "Imports" }).getByRole("heading", { level: 3 }),
  ).toHaveText([`Import n°${otherId}`]);
});

// Spec `app-shell`, « Contenu défilant signalé » : à partir de 768 px, la carte large défile dans
// son cadre, libellés collants (sous 768 px, aller et retour empilés : tests suivants).
test("round scorecard shows hole scores, totals and marks in a sticky frame at 800 px", async ({
  page,
  players,
}) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto(`/rounds/${seedRound(referenceRound(players))}`);
  const table = page.getByRole("table", { name: "Carte de score", exact: true });
  const gab = table
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: "Gab", exact: true }) });
  const cells = gab.getByRole("cell");
  await expect(cells.nth(0)).toHaveText("5, bogey");
  await expect(cells.nth(6).locator('[data-mark="birdie"]')).toHaveText("4, birdie");
  await expect(cells.nth(0).locator('[data-mark="bogey"]')).toBeVisible();
  await expect(cells.nth(9)).toHaveText("38");
  await expect(cells.nth(19)).toHaveText("34");
  await expect(cells.nth(20)).toHaveText("72");
  await expect(
    table
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: "Manu", exact: true }) })
      .getByRole("cell")
      .last(),
  ).toHaveText("88");
  const frame = page.locator('[data-slot="scroll-viewport"]');
  await frame.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  const bounds = await frame.boundingBox();
  if (!bounds) throw new Error("Missing bounds bounds");
  const label = await table.getByRole("rowheader", { name: "Gab", exact: true }).boundingBox();
  if (!label) throw new Error("Missing label bounds");
  expect(label.x).toBeGreaterThanOrEqual(bounds.x);
  expect(label.x + label.width).toBeLessThan(bounds.x + bounds.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

/** Les rangées de la carte de 4 joueurs, dans l'ordre : par, index, puis les joueurs. */
const FOUR_PLAYER_ROWS = ["Par", "Index", "Gab", "Manu", "Sean", "Alex"];

// Spec `rounds`, « Carte sur téléphone » (design D9). Mutation : la carte large de 18 colonnes
// rendue sous 768 px (blocs empilés retirés) → tables « aller » et « retour » absentes et cadre
// qui défile, rouge.
for (const width of [320, 390]) {
  test(`à ${width} px, la carte d'un round de 4 joueurs empile l'aller au-dessus du retour`, async ({
    page,
    players,
  }) => {
    const Alex = seedPlayer("Alex");
    const id = seedRound(fourPlayerRound({ ...players, Alex }));
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/rounds/${id}`);
    const front = page.getByRole("table", { name: "Carte de score, aller" });
    const back = page.getByRole("table", { name: "Carte de score, retour" });
    await expect(front.getByRole("columnheader")).toHaveText([
      "Trou",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "OUT",
    ]);
    await expect(back.getByRole("columnheader")).toHaveText([
      "Trou",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "IN",
      "TOT",
    ]);
    const frontBox = await front.boundingBox();
    const backBox = await back.boundingBox();
    if (!frontBox || !backBox) throw new Error("Bloc aller ou retour absent");
    expect(backBox.y).toBeGreaterThanOrEqual(frontBox.y + frontBox.height);
    for (const block of [front, back]) {
      await expect(block.getByRole("rowheader")).toHaveText(FOUR_PLAYER_ROWS);
      for (const label of FOUR_PLAYER_ROWS) {
        const header = block.getByRole("rowheader", { name: label, exact: true });
        await header.scrollIntoViewIfNeeded();
        await expect(header).toBeInViewport({ ratio: 1 });
      }
    }
    await expect(page.getByRole("table", { name: "Carte de score", exact: true })).toHaveCount(0);
    await expectNoSideScroll(page, `/rounds/${id}`);

    // Tâche 5.2 (revue de finition) : au retour, Alex a un bogey à chaque trou et deux totaux à
    // deux chiffres. Mutations : totaux du bloc empilé sans `border-l-2 px-1` → IN et TOT à
    // moins de 8 px (320) et « TOT » contre le bord (390), rouge ; marques gardées à 22 px sous
    // 360 px → carrés voisins qui se touchent à 320 px, rouge.
    const alex = back
      .getByRole("row")
      .filter({ has: page.getByRole("rowheader", { name: "Alex", exact: true }) });
    const totalIn = await textEdges(alex.getByRole("cell").nth(9));
    const totalAll = await textEdges(alex.getByRole("cell").nth(10));
    expect(totalAll.left - totalIn.right).toBeGreaterThanOrEqual(8);
    const marks = await alex
      .locator("[data-mark]")
      .evaluateAll((elements) =>
        elements
          .map((element) => element.getBoundingClientRect())
          .map(({ left, right }) => ({ left, right })),
      );
    expect(marks).toHaveLength(9);
    const gaps = marks.slice(1).map((mark, i) => mark.left - marks[i].right);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
    const tableBox = await back.boundingBox();
    const totHead = await textEdges(back.getByRole("columnheader", { name: "TOT", exact: true }));
    expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0) - totHead.right).toBeGreaterThanOrEqual(4);
  });
}

// Spec `rounds`, « Classement à 320 px ». Mutation : `min-w-[28rem]` sur la table du classement →
// colonnes « Net » et « Rang » hors de l'écran et page plus large que 320 px, rouge.
test("à 320 px, le classement d'un round de Manu et Sean montre Brut, Net et Rang en entier", async ({
  page,
  players,
}) => {
  // Deux rounds : au second, Manu et Sean ont chacun un index.
  const pair = { Gab: players.Sean, Manu: players.Manu };
  seedRound(referenceRound(pair, { playedOn: "2026-10-01" }));
  const id = seedRound(referenceRound(pair, { playedOn: "2026-10-17" }));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/rounds/${id}`);
  const table = page.getByRole("table", { name: "Classement net" });
  const rightEdges: Record<string, boolean> = {};
  for (const name of ["Brut", "Net", "Rang"]) {
    const box = await table.getByRole("columnheader", { name, exact: true }).boundingBox();
    rightEdges[name] = (box?.x ?? 0) + (box?.width ?? Number.POSITIVE_INFINITY) <= 320;
  }
  const rows = table.locator("tbody").getByRole("row");
  await expect(rows).toHaveCount(2);
  for (const [line, row] of (await rows.all()).entries()) {
    for (const [column, name] of [
      [1, "Brut"],
      [3, "Net"],
      [4, "Rang"],
    ] as const) {
      const box = await row.getByRole("cell").nth(column).boundingBox();
      rightEdges[`${name} ${line + 1}`] =
        (box?.x ?? 0) + (box?.width ?? Number.POSITIVE_INFINITY) <= 320;
    }
  }
  expect(rightEdges).toEqual({
    Brut: true,
    Net: true,
    Rang: true,
    "Brut 1": true,
    "Net 1": true,
    "Rang 1": true,
    "Brut 2": true,
    "Net 2": true,
    "Rang 2": true,
  });
  // Même carte jouée par les deux : nets à égalité, rang 1 chacun.
  await expect(rows.locator("td:nth-child(5)")).toHaveText(["1", "1"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

// Tâche 5.2 (revue de finition) : à 320 px, l'en-tête du handicap de jeu se réduit à « Hcp » sur
// une ligne et garde son nom complet pour les lecteurs d'écran. Mutation : en-tête « Hcp de jeu »
// visible et `whitespace-normal` (avant la revue) → deux lignes, rouge.
test("à 320 px, l'en-tête « Hcp » du classement tient sur une ligne", async ({ page, players }) => {
  // Round de 4 joueurs, le cas le plus large ; sans index, chaque nom porte sa mention dessous.
  const Alex = seedPlayer("Alex");
  const id = seedRound(fourPlayerRound({ ...players, Alex }));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/rounds/${id}`);
  // Mesures sur les polices du thème, pas sur leur repli.
  await page.evaluate(() => document.fonts.ready);
  const table = page.getByRole("table", { name: "Classement net" });
  const head = table.getByRole("columnheader", { name: "Hcp de jeu", exact: true });
  const lines = new Set((await visibleTextRects(head)).map((rect) => Math.round(rect.top)));
  expect(lines.size).toBe(1);
});

// Design D9 : à 1 440 px, une seule rangée de 18 trous, sans cadre qui défile. Mutation : la
// grille large masquée à partir de 768 px (blocs empilés partout) → table absente, rouge.
test("à 1440 px, la carte de score tient sur une rangée de 18 trous", async ({ page, players }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/rounds/${seedRound(referenceRound(players))}`);
  const table = page.getByRole("table", { name: "Carte de score", exact: true });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Trou",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "OUT",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "IN",
    "TOT",
  ]);
  const frame = page.locator('[data-slot="scroll-frame"]');
  await expect(frame).not.toHaveAttribute("data-overflow-end");
  await expect(page.getByRole("table", { name: "Carte de score, aller" })).toHaveCount(0);
});
