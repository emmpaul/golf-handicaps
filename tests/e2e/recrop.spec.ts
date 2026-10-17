import { seedFailedImport } from "./data";
import { expect, test } from "./fixtures";
import { placeCorners } from "./import";

test("un import en échec se recadre sur sa photo, repasse en attente puis est lu", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = seedFailedImport();
  await page.goto("/import");
  const item = page.getByRole("listitem").filter({ hasText: `Import n°${id}` });
  await expect(item.getByTestId("import-status")).toHaveText("Échec");
  await expect(item.getByRole("link", { name: "Ouvrir l'écran de correction vide" })).toBeVisible();
  await item.getByRole("link", { name: "Recadrer la photo" }).click();

  await page.waitForURL(`**/imports/${id}/recadrer`);
  const photo = page.getByRole("img", { name: "Carte à cadrer" });
  await expect(photo).toBeVisible();
  expect(await photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3000);
  await placeCorners(page);
  await page.getByRole("button", { name: "Valider le cadrage" }).click();
  await expect(page.getByRole("img", { name: "Carte redressée" })).toBeVisible();
  const recropped = page.waitForResponse((response) =>
    response.url().endsWith(`/api/imports/${id}/corners`),
  );
  await page.getByRole("button", { name: "Lancer la lecture" }).click();
  const response = await recropped;
  expect([response.status(), (await response.json()).label]).toEqual([200, "En attente"]);

  await page.waitForURL("**/import");
  await expect(item.getByTestId("import-status")).toHaveText("Prêt à vérifier", {
    timeout: 90_000,
  });
  await expect(item.getByRole("link", { name: "Vérifier" })).toBeVisible();
});

const WARNING = "Recadrer relance la lecture et remplace tes corrections";

test("le recadrage d'un import corrigé prévient qu'il remplace les corrections", async ({
  page,
}) => {
  const id = seedFailedImport({
    version: 1,
    card: { courseName: "BETHPAGE BLACK", playedOn: "2026-10-13" },
  });
  await page.goto(`/imports/${id}/recadrer`);
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toBeVisible();
  await expect(page.getByText(WARNING)).toBeVisible();
});

test("le recadrage d'un import sans correction n'affiche pas l'avertissement", async ({ page }) => {
  const id = seedFailedImport();
  await page.goto(`/imports/${id}/recadrer`);
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toBeVisible();
  await expect(page.getByText(WARNING)).toHaveCount(0);
});
