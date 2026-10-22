import type { Page } from "@playwright/test";
import { referenceRound, seedRound } from "./data";
import { expect, test } from "./fixtures";
import { planGabAndManuOnBethpage } from "./strokes";

const ALL_BUT_3 = "Trous : 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18";
const ALL_BUT_3_AND_14 = "Trous : 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18";

const result = (page: Page, name: string) =>
  page.getByRole("list", { name: "Coups reçus" }).getByRole("listitem").filter({ hasText: name });

test("Sean, sans index, est grisé et ne peut pas être choisi", async ({ page, players }) => {
  seedRound(referenceRound(players));
  await page.goto("/strokes");
  await expect(page.getByRole("checkbox", { name: /^Sean/ })).toBeDisabled();
  await expect(page.getByTestId("player-choice-Sean")).toContainText("pas encore d'index");
  await expect(page.getByTestId("player-choice-Sean")).toHaveAttribute("data-disabled", "true");
  await expect(page.getByRole("checkbox", { name: /^Gab/ })).toBeEnabled();
});

test("Gab et Manu sur Bethpage Black / Red : Écart 0 et 16, Complet 1 et 17, trous listés", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players));
  await planGabAndManuOnBethpage(page);
  // Spec `match-strokes`, « Parcours sans rating ». Mutation : mention absente ou lien ailleurs.
  await expect(page.getByTestId("course-rating")).toHaveText("sans rating");
  await expect(page.getByTestId("course-rating")).toHaveAttribute("href", "/courses");

  await expect(page.getByRole("radio", { name: "Écart" })).toBeChecked();
  await expect(result(page, "Gab").getByTestId("strokes-total")).toHaveText("Gab reçoit 0 coup");
  await expect(result(page, "Gab").getByTestId("strokes-holes")).toHaveText("Aucun coup");
  await expect(result(page, "Manu").getByTestId("strokes-total")).toHaveText(
    "Manu reçoit 16 coups",
  );
  await expect(result(page, "Manu").getByTestId("strokes-holes")).toHaveText(ALL_BUT_3_AND_14);

  await page.getByRole("radio", { name: "Complet" }).click();
  await expect(result(page, "Gab").getByTestId("strokes-total")).toHaveText("Gab reçoit 1 coup");
  await expect(result(page, "Gab").getByTestId("strokes-holes")).toHaveText("Trous : 15");
  await expect(result(page, "Manu").getByTestId("strokes-total")).toHaveText(
    "Manu reçoit 17 coups",
  );
  await expect(result(page, "Manu").getByTestId("strokes-holes")).toHaveText(ALL_BUT_3);
});
