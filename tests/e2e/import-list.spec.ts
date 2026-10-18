import type { Page } from "@playwright/test";
import {
  referenceRound,
  seedFailedImport,
  seedPanelNotFoundImport,
  seedReadyImport,
  seedRound,
} from "./data";
import { expect, test } from "./fixtures";

const NOT_FOUND = "Panneau introuvable sur la photo";

/** Ligne de la liste des imports pour l'import `id`, sur la page d'import. */
async function importRow(page: Page, id: number) {
  await page.goto("/import");
  return page
    .getByRole("list", { name: "Imports" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `Import n°${id}` }) });
}

test("un import sans cadrage trouvé affiche « Panneau introuvable » et propose recadrage et écran vide", async ({
  page,
}) => {
  const id = seedPanelNotFoundImport();
  const row = await importRow(page, id);
  await expect(row.getByTestId("import-status")).toHaveText("Échec");
  await expect(row.getByText(NOT_FOUND)).toBeVisible();
  await expect(row.getByRole("link")).toHaveText([
    "Recadrer la photo",
    "Ouvrir l'écran de correction vide",
  ]);
  await expect(row.getByRole("link", { name: "Recadrer la photo" })).toHaveAttribute(
    "href",
    `/imports/${id}/recadrer`,
  );
});

test("un import en échec de lecture, avec des coins, garde l'« Échec » générique", async ({
  page,
}) => {
  const row = await importRow(page, seedFailedImport());
  await expect(row.getByTestId("import-status")).toHaveText("Échec");
  await expect(row.getByText(NOT_FOUND)).toHaveCount(0);
});

test("un import prêt sans round propose « Vérifier » et « Recadrer la photo »", async ({
  page,
}) => {
  const id = seedReadyImport();
  const row = await importRow(page, id);
  await expect(row.getByTestId("import-status")).toHaveText("Prêt à vérifier");
  await expect(row.getByRole("link")).toHaveText(["Vérifier", "Recadrer la photo"]);
  await expect(row.getByRole("link", { name: "Vérifier" })).toHaveAttribute(
    "href",
    `/imports/${id}`,
  );
  await expect(row.getByRole("link", { name: "Recadrer la photo" })).toHaveAttribute(
    "href",
    `/imports/${id}/recadrer`,
  );
});

test("un import déjà enregistré en round ne propose que « Voir le round »", async ({
  page,
  players,
}) => {
  const roundId = seedRound(referenceRound(players));
  const row = await importRow(page, seedReadyImport(undefined, { roundId }));
  await expect(row.getByRole("link")).toHaveText(["Voir le round"]);
});
