import { referenceRound, seedRound } from "./data";
import { saveButton } from "./editor";
import { expect, test } from "./fixtures";
import { openReferenceCorrection } from "./import";

test("réimporter la photo de référence avertit d'un doublon, avec un lien vers le round", async ({
  page,
  players,
}) => {
  test.setTimeout(90_000);
  const existing = seedRound(referenceRound(players));
  await openReferenceCorrection(page);
  await saveButton(page).click();

  const warning = page.getByRole("main").getByRole("alert");
  await expect(warning).toContainText("Ce round semble déjà enregistré");
  await expect(warning.getByRole("link", { name: "Voir le round existant" })).toHaveAttribute(
    "href",
    `/rounds/${existing}`,
  );
  await expect(page).toHaveURL(/\/imports\/1$/);

  await warning.getByRole("button", { name: "Enregistrer quand même" }).click();
  await page.waitForURL("**/rounds");
  await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(2);
});
