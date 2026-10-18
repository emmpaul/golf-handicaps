import { expect, OCR_SHARD, test } from "./fixtures";
import { enqueueReferencePhoto } from "./import";

test(
  "trois photos envoyées à la suite donnent trois imports listés avec leur état",
  OCR_SHARD,
  async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/import");
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) ids.push((await enqueueReferencePhoto(page)).id);
    expect(ids).toEqual([1, 2, 3]);

    const imports = page.getByRole("list", { name: "Imports" }).getByRole("listitem");
    await expect(imports).toHaveCount(3);
    await expect(imports.getByRole("heading")).toHaveText([
      "Import n°3",
      "Import n°2",
      "Import n°1",
    ]);
    for (const item of await imports.all()) {
      await expect(item.getByTestId("import-status")).toHaveText(
        /^(En attente|Lecture en cours|Prêt à vérifier)$/,
      );
    }
    await expect(imports.getByTestId("import-status")).toHaveText(
      ["Prêt à vérifier", "Prêt à vérifier", "Prêt à vérifier"],
      { timeout: 150_000 },
    );
  },
);
