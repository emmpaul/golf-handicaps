import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
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

/** Place les 4 poignées sur des coins donnés (par défaut ceux de la photo de référence). */
export async function placeCorners(page: Page, corners: Corners = REFERENCE_CORNERS) {
  for (const corner of Object.keys(HANDLE_NAMES) as (keyof Corners)[]) {
    await dragHandle(page, HANDLE_NAMES[corner], corners[corner]);
  }
}

/** Envoie la photo de référence cadrée sur ses coins : l'import est mis en file. */
export async function enqueueReferencePhoto(page: Page) {
  await choosePhoto(page);
  await placeCorners(page);
  await page.getByRole("button", { name: "Valider le cadrage" }).click();
  const created = page.waitForResponse(
    (response) => response.url().endsWith("/api/imports") && response.status() === 201,
  );
  await page.getByRole("button", { name: "Lancer la lecture" }).click();
  return (await (await created).json()) as { id: number };
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
