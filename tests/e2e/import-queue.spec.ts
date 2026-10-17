import { expect, test } from "./fixtures";
import { choosePhoto, dragHandle, enqueueReferencePhoto } from "./import";

test("une poignée suit la souris, puis l'aperçu redressé s'affiche en rectangle", async ({
  page,
}) => {
  await page.goto("/import");
  await choosePhoto(page);
  await dragHandle(page, "Coin haut gauche", { x: 0.2, y: 0.3 });
  const photo = await page.getByRole("img", { name: "Carte à cadrer" }).boundingBox();
  const handle = await page.getByRole("button", { name: "Coin haut gauche" }).boundingBox();
  if (!photo || !handle) throw new Error("Photo ou poignée absente");
  const center = {
    x: (handle.x + handle.width / 2 - photo.x) / photo.width,
    y: (handle.y + handle.height / 2 - photo.y) / photo.height,
  };
  expect(center.x).toBeCloseTo(0.2, 2);
  expect(center.y).toBeCloseTo(0.3, 2);

  await page.getByRole("button", { name: "Valider le cadrage" }).click();
  const preview = page.getByRole("img", { name: "Carte redressée" });
  await expect(preview).toBeVisible();
  const size = await preview.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(size).toEqual([1200, 612]);
});

test("trois photos envoyées à la suite donnent trois imports listés avec leur état", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/import");
  const ids: number[] = [];
  for (let i = 0; i < 3; i++) ids.push((await enqueueReferencePhoto(page)).id);
  expect(ids).toEqual([1, 2, 3]);

  const imports = page.getByRole("list", { name: "Imports" }).getByRole("listitem");
  await expect(imports).toHaveCount(3);
  await expect(imports.getByRole("heading")).toHaveText(["Import n°3", "Import n°2", "Import n°1"]);
  for (const item of await imports.all()) {
    await expect(item.getByTestId("import-status")).toHaveText(
      /^(En attente|Lecture en cours|Prêt à vérifier)$/,
    );
  }
  await expect(imports.getByTestId("import-status")).toHaveText(
    ["Prêt à vérifier", "Prêt à vérifier", "Prêt à vérifier"],
    { timeout: 150_000 },
  );
});
