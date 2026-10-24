import type { Page } from "@playwright/test";
import { referenceRound, scoresOverPar, seedRound } from "./data";
import { expect, test } from "./fixtures";

const MANU_83 = [6, 5, 3, 6, 5, 5, 5, 3, 5, 3, 5, 5, 6, 4, 5, 4, 3, 5];

/** Texte affiché des cellules : sans la date courte ni la marque réservées aux téléphones. */
const VISIBLE_TEXT = { useInnerText: true };

const section = (page: Page, name: string) => page.getByRole("region", { name });
const differentialRows = (page: Page, name: string) =>
  page.getByRole("table", { name: `Différentiels de ${name}` }).getByRole("row");

test("index affiché, mention « provisoire », « — » sans round, un point par round", async ({
  page,
  players,
}) => {
  const both = referenceRound(players, { playedOn: "2026-10-01" });
  seedRound(both);
  const manu83 = structuredClone(both);
  manu83.players[1].scores = { holes: MANU_83, out: 43, in: 40, total: 83 };
  seedRound({ ...manu83, playedOn: "2026-10-10" });
  seedRound({ ...both, playedOn: "2026-10-17", players: [both.players[0]] });

  await page.goto("/handicaps");
  await expect(section(page, "Gab").getByTestId("player-index")).toHaveText("-1,0");
  await expect(section(page, "Manu").getByTestId("player-index")).toHaveText("14,5");
  await expect(section(page, "Sean").getByTestId("player-index")).toHaveText("pas encore d'index");

  const gabCurve = page.getByRole("figure", { name: "Courbe de l'index de Gab" });
  await expect(gabCurve.locator(".recharts-line-dot")).toHaveCount(3);
  await expect(
    page.getByRole("figure", { name: "Courbe de l'index de Manu" }).locator(".recharts-line-dot"),
  ).toHaveCount(2);
  await expect(page.getByRole("figure", { name: "Courbe de l'index de Sean" })).toHaveCount(0);

  // Trois différentiels égaux : le plus ancien est celui retenu (meilleur − 2,0).
  const gab = differentialRows(page, "Gab");
  await expect(gab.nth(1).getByRole("cell")).toHaveText(
    ["17 octobre 2026", "1,0", "-1,0", ""],
    VISIBLE_TEXT,
  );
  await expect(gab.nth(2).getByRole("cell")).toHaveText(
    ["10 octobre 2026", "1,0", "1,0", ""],
    VISIBLE_TEXT,
  );
  await expect(gab.nth(3).getByRole("cell")).toHaveText(
    ["1 octobre 2026", "1,0", "1,0", "Compte"],
    VISIBLE_TEXT,
  );
});

test("sur 6 rounds, les 2 meilleurs différentiels sont marqués comme comptant", async ({
  page,
  players,
}) => {
  const differentials = [17, 12, 20, 15, 14, 18];
  for (const [i, over] of differentials.entries()) {
    const round = referenceRound(players, { playedOn: `2026-10-0${i + 1}` });
    seedRound({ ...round, players: [{ ...round.players[0], scores: scoresOverPar(over) }] });
  }
  await page.goto("/handicaps");
  await expect(section(page, "Gab").getByTestId("player-index")).toHaveText("12,0");
  const counted = differentialRows(page, "Gab").filter({ hasText: "Compte" });
  await expect(counted).toHaveCount(2);
  await expect(counted.nth(0).getByRole("cell")).toHaveText(
    ["5 octobre 2026", "14,0", "12,0", "Compte"],
    VISIBLE_TEXT,
  );
  await expect(counted.nth(1).getByRole("cell")).toHaveText(
    ["2 octobre 2026", "12,0", "14,5", "Compte"],
    VISIBLE_TEXT,
  );
});

test("mobile player selection persists and desktop shows every player", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players, { playedOn: "2026-10-01" }));
  seedRound(referenceRound(players, { playedOn: "2026-10-17" }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/handicaps");
  const selector = page.getByRole("navigation", { name: "Choisir un joueur" });
  await expect(selector.getByRole("link", { name: "Gab" })).toHaveAttribute("aria-current", "page");
  await expect(section(page, "Gab")).toBeVisible();
  await expect(section(page, "Manu")).toBeHidden();
  await expect(section(page, "Sean")).toBeHidden();
  await expect(section(page, "Gab").getByTestId("player-index")).toHaveText("1,0");
  await expect(section(page, "Gab").getByTestId("index-delta")).toHaveText("=");
  await selector.getByRole("link", { name: "Manu" }).click();
  await expect(page).toHaveURL(new RegExp(`joueur=${players.Manu}$`));
  await expect(section(page, "Manu")).toBeVisible();
  await expect(section(page, "Manu").getByTestId("player-index")).toHaveText("17,0");
  await expect(section(page, "Manu").getByTestId("index-delta")).toHaveText("=");
  await expect(section(page, "Manu").getByText("provisoire", { exact: true })).toBeVisible();
  await page.reload();
  await expect(section(page, "Manu")).toBeVisible();
  await expect(section(page, "Gab")).toBeHidden();
  await page.goto("/handicaps?joueur=999");
  await expect(section(page, "Gab")).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(selector).toBeHidden();
  for (const name of ["Gab", "Manu", "Sean"]) await expect(section(page, name)).toBeVisible();
});

test("at 320px the retained differential date and Compte share a row", async ({
  page,
  players,
}) => {
  for (const day of [1, 2, 3]) seedRound(referenceRound(players, { playedOn: `2026-10-0${day}` }));
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/handicaps");
  const mark = section(page, "Gab").getByText("Compte", { exact: true }).filter({ visible: true });
  const date = mark.locator("..").locator("span").first();
  const a = await mark.boundingBox();
  if (!a) throw new Error("Missing a bounds");
  const b = await date.boundingBox();
  if (!b) throw new Error("Missing b bounds");
  expect(Math.abs(a.y + a.height / 2 - b.y - b.height / 2)).toBeLessThanOrEqual(2);
  const table = page.getByRole("table", { name: "Différentiels de Gab" });
  const t = await table.boundingBox();
  if (!t) throw new Error("Missing table bounds");
  const wrapper = await table.locator("..").boundingBox();
  if (!wrapper) throw new Error("Missing wrapper bounds");
  expect(t.x + t.width).toBeLessThanOrEqual(wrapper.x + wrapper.width);
});
