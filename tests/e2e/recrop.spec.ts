import type { Page } from "@playwright/test";
import type { Corners } from "../../src/ocr/corners";
import {
  DEFAULT_CORNERS,
  importCorners,
  referenceRound,
  seedFailedImport,
  seedPanelNotFoundImport,
  seedQueuedImport,
  seedReadyImport,
  seedRound,
} from "./data";
import { expect, test } from "./fixtures";
import { dragHandle, handleCenters, placeCorners, REFERENCE_CORNERS } from "./import";

/** Valide le cadrage, attend l'aperçu, lance la lecture : réponse de l'envoi des coins. */
async function launchRecrop(page: Page, id: number) {
  await page.getByRole("button", { name: "Valider le cadrage" }).click();
  await expect(page.getByRole("img", { name: "Carte redressée" })).toBeVisible();
  const recropped = page.waitForResponse((response) =>
    response.url().endsWith(`/api/imports/${id}/corners`),
  );
  await page.getByRole("button", { name: "Lancer la lecture" }).click();
  return recropped;
}

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
  const response = await launchRecrop(page, id);
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

test("au recadrage, une poignée suit la souris, puis l'aperçu redressé s'affiche en rectangle", async ({
  page,
}) => {
  await page.goto(`/imports/${seedFailedImport()}/recadrer`);
  await dragHandle(page, "Coin haut gauche", { x: 0.2, y: 0.3 });
  const center = (await handleCenters(page)).topLeft;
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

/** Les poignées sont à `expected`, à 0,005 près sur chaque axe. */
async function expectHandlesAt(page: Page, expected: Corners) {
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toBeVisible();
  const centers = await handleCenters(page);
  for (const corner of Object.keys(expected) as (keyof Corners)[]) {
    expect(centers[corner].x, corner).toBeCloseTo(expected[corner].x, 2);
    expect(centers[corner].y, corner).toBeCloseTo(expected[corner].y, 2);
  }
}

test("un import prêt se recadre depuis l'écran de correction, poignées sur ses coins, puis est relu avec eux", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const id = seedReadyImport();
  await page.goto(`/imports/${id}`);
  await page.getByRole("link", { name: "Recadrer la photo" }).click();
  await page.waitForURL(`**/imports/${id}/recadrer`);
  await expectHandlesAt(page, REFERENCE_CORNERS);

  const response = await launchRecrop(page, id);
  expect(response.request().postDataJSON()).toEqual(REFERENCE_CORNERS);
  expect([response.status(), (await response.json()).label]).toEqual([200, "En attente"]);

  await page.waitForURL("**/import");
  const item = page.getByRole("listitem").filter({ hasText: `Import n°${id}` });
  await expect(item.getByTestId("import-status")).toHaveText("Prêt à vérifier", {
    timeout: 90_000,
  });
  expect(importCorners(id)).toEqual({ corners: REFERENCE_CORNERS, cornersSource: "manual" });
});

test("le recadrage d'un import en « Panneau introuvable » place les poignées à 10 % et 90 %", async ({
  page,
}) => {
  await page.goto(`/imports/${seedPanelNotFoundImport()}/recadrer`);
  await expectHandlesAt(page, DEFAULT_CORNERS);
});

test("le recadrage d'un import en lecture renvoie à la liste des imports", async ({ page }) => {
  await page.goto(`/imports/${seedQueuedImport("reading")}/recadrer`);
  await page.waitForURL("**/import");
});

test("le recadrage d'un import déjà enregistré en round renvoie à la liste des imports", async ({
  page,
  players,
}) => {
  const roundId = seedRound(referenceRound(players));
  await page.goto(`/imports/${seedReadyImport(undefined, { roundId })}/recadrer`);
  await page.waitForURL("**/import");
});

const AI_FRAMING = "Cadrage trouvé par l'IA, vérifie la photo";

test("l'écran de correction d'un import cadré par l'IA affiche la note du cadrage", async ({
  page,
}) => {
  await page.goto(`/imports/${seedReadyImport(undefined, { cornersSource: "ai" })}`);
  await expect(page.getByRole("alert").filter({ hasText: AI_FRAMING })).toBeVisible();
});

test("l'écran de correction d'un import cadré localement n'affiche pas la note du cadrage", async ({
  page,
}) => {
  await page.goto(`/imports/${seedReadyImport(undefined, { cornersSource: "auto" })}`);
  await expect(page.getByRole("link", { name: "Recadrer la photo" })).toBeVisible();
  await expect(page.getByText(AI_FRAMING)).toHaveCount(0);
});

test("l'écran de correction d'un import en lecture ne propose pas de recadrer", async ({
  page,
}) => {
  await page.goto(`/imports/${seedQueuedImport("reading")}`);
  await expect(page.getByRole("img", { name: "Carte importée" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Recadrer la photo" })).toHaveCount(0);
});
