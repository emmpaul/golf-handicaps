import type { Page } from "@playwright/test";
import {
  referenceRound,
  seedFailedImport,
  seedQueuedImport,
  seedReadyImport,
  seedRound,
  setImportStatus,
} from "./data";
import { expect, test } from "./fixtures";

/** Spec `scorecard-import`, « Suppression d'un import » (tâches 3.1 et 3.2). */

const importList = (page: Page) => page.getByRole("list", { name: "Imports" });

/** Ligne de la liste des imports pour l'import `id`. */
const importRow = (page: Page, id: number) =>
  importList(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `Import n°${id}` }) });

const deleteButton = (page: Page, id: number) =>
  importRow(page, id).getByRole("button", { name: "Supprimer", exact: true });

const dialog = (page: Page) => page.getByRole("alertdialog", { name: "Supprimer cet import ?" });

test("un import en échec supprimé et confirmé disparaît de la liste, sa photo n'est plus servie", async ({
  page,
}) => {
  const id = seedFailedImport();
  const kept = seedReadyImport();
  await page.goto("/import");
  await deleteButton(page, id).click();
  await expect(
    dialog(page).getByText("La photo et la correction en cours seront effacées."),
  ).toBeVisible();
  await dialog(page).getByRole("button", { name: "Supprimer" }).click();

  await expect(importList(page).getByRole("heading")).toHaveText([`Import n°${kept}`]);
  await expect(dialog(page)).toHaveCount(0);
  const photo = await page.request.get(`/api/imports/${id}/photo`);
  expect(photo.status()).toBe(404);
});

test("une suppression annulée laisse l'import dans la liste avec son état", async ({ page }) => {
  const id = seedFailedImport();
  await page.goto("/import");
  await deleteButton(page, id).click();
  await dialog(page).getByRole("button", { name: "Annuler" }).click();

  await expect(dialog(page)).toHaveCount(0);
  await expect(importRow(page, id).getByTestId("import-status")).toHaveText("Échec");
  const photo = await page.request.get(`/api/imports/${id}/photo`);
  expect(photo.status()).toBe(200);
});

test("« Supprimer » n'est proposé que sur les imports en attente, prêts ou en échec sans round", async ({
  page,
  players,
}) => {
  const queued = seedQueuedImport("queued");
  const ready = seedReadyImport();
  const failed = seedFailedImport();
  const reading = seedQueuedImport("reading");
  const saved = seedReadyImport(undefined, { roundId: seedRound(referenceRound(players)) });
  await page.goto("/import");

  await expect(importList(page).getByRole("listitem")).toHaveCount(5);
  await expect(
    importList(page).getByRole("button", { name: "Supprimer", exact: true }),
  ).toHaveCount(3);
  for (const id of [queued, ready, failed]) await expect(deleteButton(page, id)).toHaveCount(1);
  for (const id of [reading, saved]) await expect(deleteButton(page, id)).toHaveCount(0);
});

test("un import passé en lecture avant la confirmation : le dialogue se ferme et la liste montre « Lecture en cours »", async ({
  page,
}) => {
  const id = seedFailedImport();
  await page.goto("/import");
  await deleteButton(page, id).click();
  setImportStatus(id, "reading");
  await dialog(page).getByRole("button", { name: "Supprimer" }).click();

  await expect(dialog(page)).toHaveCount(0);
  await expect(importRow(page, id).getByTestId("import-status")).toHaveText("Lecture en cours");
  await expect(importList(page).getByRole("heading")).toHaveText([`Import n°${id}`]);
});
