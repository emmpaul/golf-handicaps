import { referenceRound, seedRound } from "./data";
import { cell, fillRow, rowValues, saveButton } from "./editor";
import { expect, test } from "./fixtures";

const asText = (values: readonly number[]) => values.map(String);

test("en saisie manuelle, choisir « Bethpage Black / Red » pré-remplit pars, index et distances", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players, { playedOn: "2026-10-10" }));
  await page.goto("/rounds/new");
  await expect(page.getByRole("img", { name: "Carte importée" })).toHaveCount(0);
  await page.getByLabel("Parcours connu").selectOption({ label: "Bethpage Black / Red" });

  await expect(page.getByLabel("Parcours", { exact: true })).toHaveValue("Bethpage Black");
  await expect(page.getByLabel("Tees")).toHaveValue("Red");
  expect(await rowValues(page, "Par")).toEqual(
    asText([4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 4, 3, 4]),
  );
  expect(await rowValues(page, "Index")).toEqual(
    asText([8, 16, 18, 2, 4, 10, 6, 14, 12, 9, 11, 7, 3, 17, 1, 5, 13, 15]),
  );
  expect(await rowValues(page, "Distance")).toEqual(
    asText([
      420, 344, 128, 444, 398, 377, 480, 155, 392, 353, 405, 392, 470, 149, 401, 423, 173, 337,
    ]),
  );
  await expect(cell(page, "Par", "TOT")).toHaveValue("71");
  await expect(saveButton(page)).toHaveText("19 problèmes à corriger");

  await page.getByLabel("Date").fill("2026-10-17");
  await page.getByLabel("Joueur de la ligne 1").selectOption({ label: "Sean" });
  await fillRow(page, "Ligne 1", Array(18).fill(5));
  await saveButton(page).click();
  await page.waitForURL("**/rounds");
  await expect(page.getByTestId("round-gross")).toHaveText(["Sean 90", "Gab 72", "Manu 88"]);
});
