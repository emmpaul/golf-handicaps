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
  await expect(section(page, "Gab").getByTestId("player-index")).toHaveText("Index -1,0");
  await expect(section(page, "Manu").getByTestId("player-index")).toHaveText(
    "Index 14,5 (provisoire)",
  );
  await expect(section(page, "Sean").getByTestId("player-index")).toHaveText("Index —");

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
  await expect(section(page, "Gab").getByTestId("player-index")).toHaveText("Index 12,0");
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
