import type { Page } from "@playwright/test";
import { referenceRound, scoresOverPar, seedRound } from "./data";
import { expect, expectNoHorizontalScroll, test } from "./fixtures";
import { planGabAndManuOnBethpage } from "./strokes";

const result = (page: Page, name: string) =>
  page.getByRole("list", { name: "Coups reçus" }).getByRole("listitem").filter({ hasText: name });

test("Sean without an index cannot be selected", async ({ page, players }) => {
  seedRound(referenceRound(players));
  await page.goto("/strokes");
  await expect(page.getByRole("checkbox", { name: /^Sean/ })).toBeDisabled();
  await expect(page.getByTestId("player-choice-Sean")).toContainText("pas encore d'index");
  await expect(page.getByTestId("player-choice-Sean")).toHaveAttribute("data-disabled", "true");
  await expect(page.getByRole("checkbox", { name: /^Gab/ })).toBeEnabled();
});

test("16 strokes fill all holes except 3 and 14, with no grid for Gab", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players));
  await planGabAndManuOnBethpage(page);
  await expect(page.getByTestId("course-rating")).toHaveText("sans rating");
  await expect(page.getByTestId("course-rating")).toHaveAttribute("href", "/courses");
  await expect(page.getByRole("radio", { name: "Écart" })).toBeChecked();
  await expect(result(page, "Gab").getByTestId("strokes-total")).toHaveText(
    "Gab ne reçoit aucun coup",
  );
  await expect(result(page, "Gab").getByTestId("strokes-holes")).toHaveCount(0);
  await expect(result(page, "Manu").getByTestId("strokes-total")).toHaveText(
    "Manu reçoit 16 coups",
  );
  for (let hole = 1; hole <= 18; hole++) {
    const empty = hole === 3 || hole === 14;
    const cell = result(page, "Manu").getByLabel(
      `Trou ${hole} : ${empty ? "aucun coup" : "1 coup"}`,
      { exact: true },
    );
    await expect(cell).toBeVisible();
    await expect(cell.locator("span").last()).toHaveText(empty ? "" : "1");
  }
  await page.getByRole("radio", { name: "Complet" }).click();
  await expect(result(page, "Gab").getByTestId("strokes-total")).toHaveText("Gab reçoit 1 coup");
  await expect(result(page, "Gab").getByLabel("Trou 15 : 1 coup", { exact: true })).toBeVisible();
  await expect(result(page, "Manu").getByTestId("strokes-total")).toHaveText(
    "Manu reçoit 17 coups",
  );
  await expect(result(page, "Manu").getByLabel("Trou 3 : aucun coup")).toBeVisible();
});

test("20 strokes use two rows of nine at 320px", async ({ page, players }) => {
  const form = referenceRound(players);
  form.players[1].scores = scoresOverPar(20);
  seedRound(form);
  await page.setViewportSize({ width: 320, height: 640 });
  await planGabAndManuOnBethpage(page);
  await page.getByRole("radio", { name: "Complet" }).click();
  const grid = result(page, "Manu").getByTestId("strokes-holes");
  for (let hole = 1; hole <= 18; hole++)
    await expect(
      grid.getByLabel(`Trou ${hole} : ${hole === 15 || hole === 4 ? "2 coups" : "1 coup"}`, {
        exact: true,
      }),
    ).toBeVisible();
  await expectNoHorizontalScroll(page);
  expect(await grid.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  // Mutation: grid-cols-9 → grid-cols-18 puts hole 10 on the first row.
  const first = await grid.getByLabel("Trou 1 : 1 coup", { exact: true }).boundingBox();
  if (!first) throw new Error("Missing first bounds");
  const ninth = await grid.getByLabel("Trou 9 : 1 coup", { exact: true }).boundingBox();
  if (!ninth) throw new Error("Missing ninth bounds");
  const tenth = await grid.getByLabel("Trou 10 : 1 coup", { exact: true }).boundingBox();
  if (!tenth) throw new Error("Missing tenth bounds");
  expect(first.y).toBe(ninth.y);
  expect(tenth.y).toBeGreaterThan(first.y);
});
