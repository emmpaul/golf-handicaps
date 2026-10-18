import sharp from "sharp";
import { expect, test } from "./fixtures";
import { chooseLargePhoto, enqueueReferencePhoto, HANDLE_NAMES, photoQueued } from "./import";

const QUEUED = "Lecture en file d'attente. Tu peux envoyer la photo suivante.";

test("une photo JPEG part en file sans écran de cadrage, réduite à 3000 px de grand côté", async ({
  page,
}) => {
  await page.goto("/import");
  const created = photoQueued(page);
  await chooseLargePhoto(page);
  const { id } = await created;
  await expect(page.getByText(QUEUED)).toBeVisible();
  const stored = await page.request.get(`/api/imports/${id}/photo`);
  const { width, height } = await sharp(await stored.body()).metadata();
  expect([width, height]).toEqual([3000, 2250]);
});

test("la photo de référence apparaît dans la liste sans aucune poignée, puis est lue", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/import");
  const { id } = await enqueueReferencePhoto(page);
  await expect(page.getByText(QUEUED)).toBeVisible();
  for (const name of Object.values(HANDLE_NAMES)) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toHaveCount(0);
  const status = page
    .getByRole("listitem")
    .filter({ hasText: `Import n°${id}` })
    .getByTestId("import-status");
  await expect(status).toHaveText(/^(En attente|Lecture en cours|Prêt à vérifier)$/);
  // Cadrage trouvé par le worker, sans clé IA : la lecture aboutit.
  await expect(status).toHaveText("Prêt à vérifier", { timeout: 60_000 });
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
