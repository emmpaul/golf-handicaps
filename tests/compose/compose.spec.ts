import { expect, test } from "@playwright/test";
import { saveButton } from "../e2e/editor";
import { openReferenceCorrection } from "../e2e/import";

/**
 * Bout en bout sur l'image Docker : connexion par le vrai code (APP_PASSCODE du .env de
 * compose), lecture de la photo de référence par le worker, enregistrement du round.
 */
test("connexion, import de la photo de référence et enregistrement du round", async ({ page }) => {
  test.setTimeout(180_000);
  const passcode = process.env.APP_PASSCODE;
  if (!passcode) throw new Error("APP_PASSCODE manquant : le même que dans le .env de compose");

  await page.goto("/login");
  await page.getByLabel("Code d'accès").fill(passcode);
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page).toHaveURL(/\/$/);

  await openReferenceCorrection(page);
  await expect(page.getByLabel("Parcours", { exact: true })).toHaveValue("BETHPAGE BLACK");
  await expect(saveButton(page)).toHaveText("Enregistrer");
  await saveButton(page).click();

  await page.waitForURL("**/rounds");
  const round = page.getByRole("listitem").filter({ hasText: "BETHPAGE BLACK" });
  await expect(round.getByTestId("round-gross")).toHaveText(["Gab 72", "Manu 88"]);
});
