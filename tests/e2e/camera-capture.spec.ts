import { expect, test } from "./fixtures";
import { photoQueued, REFERENCE_PHOTO } from "./import";

/**
 * « Prendre une photo » : visible seulement avec un pointeur grossier. Le projet `webkit-iphone`
 * répond `true` à `(pointer: coarse)`, le projet `chromium` (bureau) `false`.
 */

const CAMERA = "Prendre une photo";
const MIN_TOUCH_TARGET = 44;

test.describe("pointeur grossier (iPhone)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "webkit-iphone", "iPhone uniquement");
    await page.goto("/import");
  });

  test("le champ « Prendre une photo » ouvre la caméra arrière et n'accepte que des images", async ({
    page,
  }) => {
    const camera = page.getByLabel(CAMERA);
    await expect(camera).toHaveAttribute("capture", "environment");
    await expect(camera).toHaveAttribute("accept", "image/*");
  });

  test("le bouton « Prendre une photo » est visible et mesure au moins 44 px de haut", async ({
    page,
  }) => {
    const button = page.getByText(CAMERA);
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  test("« Photo de la carte » reste là, sans caméra imposée", async ({ page }) => {
    const file = page.getByLabel("Photo de la carte");
    await expect(file).toBeVisible();
    await expect(file).not.toHaveAttribute("capture");
  });

  test("la photo prise part en file sans cadrage, comme une photo choisie", async ({ page }) => {
    const created = photoQueued(page);
    await page.getByLabel(CAMERA).setInputFiles(REFERENCE_PHOTO);
    const { id } = await created;
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: `Import n°${id}` })
        .getByTestId("import-status"),
    ).toHaveText(/^(En attente|Lecture en cours|Prêt à vérifier)$/);
    await expect(page.getByRole("button", { name: "Coin haut gauche" })).toHaveCount(0);
  });

  test("une photo prise illisible affiche le message JPEG", async ({ page }) => {
    await page.getByLabel(CAMERA).setInputFiles({
      name: "IMG_3064.DNG",
      mimeType: "image/x-adobe-dng",
      buffer: Buffer.from("pas une image décodable"),
    });
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Format de photo non lisible, exporte-la en JPEG",
    );
  });

  test("annuler la prise de vue ne change rien à l'écran", async ({ page }) => {
    await page.getByLabel(CAMERA).setInputFiles([]);
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Imports" })).toHaveCount(0);
  });
});

test.describe("ordinateur", () => {
  test("sans écran tactile, « Prendre une photo » est caché et « Photo de la carte » visible", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "bureau uniquement");
    await page.goto("/import");
    await expect(page.getByText(CAMERA)).toBeHidden();
    await expect(page.getByLabel("Photo de la carte")).toBeVisible();
  });
});

test.describe("clavier sur écran tactile", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 } });

  test("Tab atteint « Prendre une photo » et le contour de focus s'affiche sur le bouton", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Chromium avec écran tactile");
    await page.goto("/import");
    const camera = page.getByLabel(CAMERA);
    const button = page.getByText(CAMERA);
    expect(await button.evaluate((label) => getComputedStyle(label).boxShadow)).toBe("none");
    for (let presses = 0; presses < 20; presses++) {
      await page.keyboard.press("Tab");
      if (await camera.evaluate((input) => input === document.activeElement)) break;
    }
    await expect(camera).toBeFocused();
    expect(await button.evaluate((label) => getComputedStyle(label).boxShadow)).not.toBe("none");
  });
});
