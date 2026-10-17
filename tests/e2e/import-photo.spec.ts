import sharp from "sharp";
import { expect, test } from "./fixtures";

test("une photo JPEG s'affiche à l'écran de cadrage, réduite à 3000 px de grand côté", async ({
  page,
}) => {
  const photo = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: "#204020" },
  })
    .jpeg()
    .toBuffer();
  await page.goto("/import");
  await page
    .getByLabel("Photo de la carte")
    .setInputFiles({ name: "carte.jpg", mimeType: "image/jpeg", buffer: photo });
  const shown = page.getByRole("img", { name: "Carte à cadrer" });
  await expect(shown).toBeVisible();
  const size = await shown.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(size).toEqual([3000, 2250]);
});

test("un fichier illisible affiche le message JPEG et propose la saisie manuelle", async ({
  page,
}) => {
  await page.goto("/import");
  await page.getByLabel("Photo de la carte").setInputFiles({
    name: "IMG_3064.DNG",
    mimeType: "image/x-adobe-dng",
    buffer: Buffer.from("pas une image décodable"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Format de photo non lisible, exporte-la en JPEG",
  );
  await expect(page.getByRole("link", { name: "Saisie manuelle" })).toHaveAttribute(
    "href",
    "/rounds/new",
  );
});
