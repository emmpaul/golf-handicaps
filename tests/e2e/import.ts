import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import sharp from "sharp";
import type { Corners } from "../../src/ocr/corners";

const FIXTURES = join(__dirname, "..", "fixtures", "scorecards");

/** Photo de référence IMG_3064 (3000 × 2250) et ses coins mesurés à la main. */
export const REFERENCE_PHOTO = join(FIXTURES, "gspro-img3064.jpg");
export const REFERENCE_CORNERS: Corners = JSON.parse(
  readFileSync(join(FIXTURES, "gspro-img3064.corners.json"), "utf8"),
);

export const HANDLE_NAMES = {
  topLeft: "Coin haut gauche",
  topRight: "Coin haut droit",
  bottomRight: "Coin bas droit",
  bottomLeft: "Coin bas gauche",
} as const satisfies Record<keyof Corners, string>;

export async function choosePhoto(page: Page, file = REFERENCE_PHOTO) {
  await page.getByLabel("Photo de la carte").setInputFiles(file);
}

/** Choisit une photo JPEG unie de 4000 × 3000, plus grande que les 3000 px envoyés. */
export async function chooseLargePhoto(page: Page) {
  const photo = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: "#204020" },
  })
    .jpeg()
    .toBuffer();
  await page
    .getByLabel("Photo de la carte")
    .setInputFiles({ name: "carte.jpg", mimeType: "image/jpeg", buffer: photo });
}

/** Glisse une poignée à la souris jusqu'au point normalisé `target` de la photo. */
export async function dragHandle(page: Page, name: string, target: { x: number; y: number }) {
  const button = page.getByRole("button", { name });
  await button.scrollIntoViewIfNeeded();
  const photo = await page.getByRole("img", { name: "Carte à cadrer" }).boundingBox();
  const handle = await button.boundingBox();
  if (!photo || !handle) throw new Error("Photo ou poignée absente");
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(photo.x + target.x * photo.width, photo.y + target.y * photo.height, {
    steps: 8,
  });
  await page.mouse.up();
}

/** Centre de chaque poignée, en coordonnées normalisées de la photo à cadrer. */
export async function handleCenters(page: Page): Promise<Corners> {
  const photo = await page.getByRole("img", { name: "Carte à cadrer" }).boundingBox();
  if (!photo) throw new Error("Photo absente");
  const centers = {} as Corners;
  for (const corner of Object.keys(HANDLE_NAMES) as (keyof Corners)[]) {
    const handle = await page.getByRole("button", { name: HANDLE_NAMES[corner] }).boundingBox();
    if (!handle) throw new Error(`Poignée ${HANDLE_NAMES[corner]} absente`);
    centers[corner] = {
      x: (handle.x + handle.width / 2 - photo.x) / photo.width,
      y: (handle.y + handle.height / 2 - photo.y) / photo.height,
    };
  }
  return centers;
}

/** Place les 4 poignées sur des coins donnés (par défaut ceux de la photo de référence). */
export async function placeCorners(page: Page, corners: Corners = REFERENCE_CORNERS) {
  for (const corner of Object.keys(HANDLE_NAMES) as (keyof Corners)[]) {
    await dragHandle(page, HANDLE_NAMES[corner], corners[corner]);
  }
}

/** Réponse 201 de la mise en file d'une photo (`POST /api/imports`) : l'import créé. */
export async function photoQueued(page: Page) {
  const response = await page.waitForResponse(
    (response) => response.url().endsWith("/api/imports") && response.status() === 201,
  );
  return (await response.json()) as { id: number };
}

/** Choisit la photo de référence : elle part en file sans cadrage, l'import est créé. */
export async function enqueueReferencePhoto(page: Page) {
  const created = photoQueued(page);
  await choosePhoto(page);
  return created;
}

/** Met la photo de référence en file, attend sa lecture et ouvre son écran de correction. */
export async function openReferenceCorrection(page: Page) {
  await page.goto("/import");
  const { id } = await enqueueReferencePhoto(page);
  const item = page.getByRole("listitem").filter({ hasText: `Import n°${id}` });
  await item.getByRole("link", { name: "Vérifier" }).click({ timeout: 60_000 });
  await page.waitForURL(`**/imports/${id}`);
  return id;
}
