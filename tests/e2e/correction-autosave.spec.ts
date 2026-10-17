import type { Browser, BrowserContextOptions, Page } from "@playwright/test";
import type { ScorecardDraft } from "../../src/scorecard/draft";
import referenceDraft from "../fixtures/scorecards/gspro-img3064.draft.json";
import { referenceRound, seedReadyImport, seedRound } from "./data";
import { cell, saveButton } from "./editor";
import { expect, test } from "./fixtures";
import { authenticate } from "./session";

const AI_DESCRIPTION = "complété par l'IA";

/** Brouillon de référence dont la ligne 1 a été lue « JULIEN » : aucun joueur associé. */
function julienDraft(): ScorecardDraft {
  const draft = structuredClone(referenceDraft) as ScorecardDraft;
  draft.players[0].name = "JULIEN";
  return draft;
}

const status = (page: Page) => page.getByRole("status");
const chosenPlayer = (page: Page, line: number) =>
  page.getByLabel(`Joueur de la ligne ${line}`).locator("option:checked");

/** Attend que la sauvegarde automatique ait abouti. */
const expectSaved = (page: Page) => expect(status(page)).toHaveText("Enregistré");

/** Deuxième appareil : un autre contexte de navigateur, avec sa propre session. */
async function otherDevice(browser: Browser, use: BrowserContextOptions, baseURL?: string) {
  const context = await browser.newContext(use);
  await authenticate(context, baseURL);
  return context;
}

test("le joueur choisi et la case corrigée reviennent après un rechargement", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport(julienDraft())}`);
  await expect(chosenPlayer(page, 1)).toHaveText("Choisir un joueur");
  await page.getByLabel("Joueur de la ligne 1").selectOption({ label: "Gab" });
  await expect(cell(page, "Ligne 2", 1)).toHaveValue("7");
  await cell(page, "Ligne 2", 1).fill("6");
  await expectSaved(page);

  await page.reload();
  await expect(chosenPlayer(page, 1)).toHaveText("Gab");
  await expect(cell(page, "Ligne 2", 1)).toHaveValue("6");
});

test("la date modifiée revient après un rechargement", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport(julienDraft())}`);
  await expect(page.getByLabel("Date")).toHaveValue("2026-10-17");
  await page.getByLabel("Date").fill("2026-10-13");
  await expectSaved(page);

  await page.reload();
  await expect(page.getByLabel("Date")).toHaveValue("2026-10-13");
});

test("une case remplie par l'IA puis corrigée reste sans marque après un rechargement", async ({
  page,
}) => {
  await page.goto(`/imports/${seedReadyImport(undefined, { aiCells: ["player0:9"] })}`);
  const gab9 = cell(page, "Ligne 1", 9);
  await expect(gab9).toHaveAccessibleDescription(AI_DESCRIPTION);
  await gab9.fill("4");
  await expectSaved(page);

  await page.reload();
  await expect(cell(page, "Ligne 1", 9)).toHaveValue("4");
  await expect(page.locator(`[aria-description="${AI_DESCRIPTION}"]`)).toHaveCount(0);
  await expect(page.getByTestId("ai-mark")).toHaveCount(0);
});

test("une case corrigée juste avant de fermer la page est là à la réouverture", async ({
  context,
}) => {
  const id = seedReadyImport();
  const page = await context.newPage();
  await page.goto(`/imports/${id}`);
  await expect(cell(page, "Ligne 1", 9)).toHaveValue("5");
  await cell(page, "Ligne 1", 9).fill("4");
  // Moins d'une seconde après : seul l'envoi de sortie de page (keepalive) peut la sauver.
  await page.close({ runBeforeUnload: true });

  const reopened = await context.newPage();
  // L'envoi de sortie peut arriver au serveur juste après la réouverture : on recharge.
  await expect(async () => {
    await reopened.goto(`/imports/${id}`);
    await expect(cell(reopened, "Ligne 1", 9)).toHaveValue("4", { timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
});

test("le joueur associé sur un appareil s'affiche sur l'autre", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const id = seedReadyImport(julienDraft());
  await page.goto(`/imports/${id}`);
  await page.getByLabel("Joueur de la ligne 2").selectOption({ label: "Sean" });
  await expectSaved(page);

  const computer = await otherDevice(browser, testInfo.project.use, baseURL);
  const other = await computer.newPage();
  await other.goto(`/imports/${id}`);
  await expect(chosenPlayer(other, 2)).toHaveText("Sean");
  await computer.close();
});

test("après l'enregistrement du round sur un appareil, l'autre affiche que la carte est enregistrée", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  const id = seedReadyImport();
  await page.goto(`/imports/${id}`);
  const gabDevice = await otherDevice(browser, testInfo.project.use, baseURL);
  const gab = await gabDevice.newPage();
  await gab.goto(`/imports/${id}`);
  await expect(saveButton(gab)).toHaveText("Enregistrer");
  await saveButton(gab).click();
  await gab.waitForURL("**/rounds");
  await gabDevice.close();

  await cell(page, "Ligne 1", 9).fill("4");
  await expect(status(page)).toHaveText("Cette carte est déjà enregistrée");
});

test("après un round refusé comme doublon, la case corrigée est encore sauvegardée", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players));
  await page.goto(`/imports/${seedReadyImport()}`);
  await saveButton(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Ce round semble déjà enregistré",
  );

  await cell(page, "Ligne 1", 9).fill("4");
  await expectSaved(page);
  await page.reload();
  await expect(cell(page, "Ligne 1", 9)).toHaveValue("4");
});

test("en saisie manuelle, modifier une case n'envoie rien vers /api/imports", async ({ page }) => {
  const importRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/imports")) {
      importRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.goto("/rounds/new");
  await cell(page, "Par", 1).fill("4");
  await expect(cell(page, "Par", 1)).toHaveValue("4");
  // Au-delà du délai de 1 s de la sauvegarde automatique : un envoi aurait eu le temps de partir.
  await page.waitForTimeout(1_500);
  expect(importRequests).toEqual([]);
  await expect(status(page)).toHaveText("");
});
