import type { Page } from "@playwright/test";
import { referenceRound, roundDates, seedReadyImport, seedRound } from "./data";
import { pickDate, saveButton } from "./editor";
import { expect, test } from "./fixtures";

/** Champ « Date » de l'écran de correction : un bouton qui ouvre le calendrier. */
const dateField = (page: Page) => page.getByLabel("Date");
const calendar = (page: Page) => page.getByRole("grid");
const selectedDay = (page: Page) => page.locator('[role="gridcell"][aria-selected="true"]');

// Aujourd'hui fixé loin d'octobre 2026 : un calendrier ouvert sur le mois courant se verrait.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-12-05T12:00:00Z"));
});

test("le champ Date affiche la date lue et ouvre le calendrier français sur son mois", async ({
  page,
}) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  await expect(dateField(page)).toHaveText("17 octobre 2026");
  await dateField(page).click();
  await expect(calendar(page)).toHaveAccessibleName("octobre 2026");
  await expect(selectedDay(page)).toHaveAttribute("data-day", "2026-10-17");
  // Semaine au lundi : la grille d'octobre 2026 commence le lundi 28 septembre.
  await expect(calendar(page).getByRole("gridcell").first()).toHaveAccessibleName(
    "lundi 28 septembre 2026",
  );
});

test("choisir le 13 ferme le calendrier et affiche « 13 octobre 2026 »", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  await dateField(page).click();
  await calendar(page)
    .getByRole("button", { name: /^mardi 13 octobre 2026$/ })
    .click();
  await expect(calendar(page)).toHaveCount(0);
  await expect(dateField(page)).toHaveText("13 octobre 2026");
});

test("choisir mars, 2025 puis le 4 affiche « 4 mars 2025 »", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  await pickDate(page, "2025-03-04");
  await expect(dateField(page)).toHaveText("4 mars 2025");
});

test("la date remplie par l'IA perd sa marque quand on choisit un autre jour", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport(undefined, { aiCells: ["playedOn"] })}`);
  await expect(dateField(page)).toHaveAccessibleDescription("complété par l'IA");
  await expect(page.getByTestId("ai-mark")).toHaveCount(1);
  await pickDate(page, "2026-10-13");
  await expect(dateField(page)).toHaveText("13 octobre 2026");
  await expect(dateField(page)).not.toHaveAttribute("aria-description");
  await expect(page.getByTestId("ai-mark")).toHaveCount(0);
});

test("au clavier, Entrée, deux Flèche gauche puis Entrée choisissent le 15", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  await dateField(page).focus();
  await page.keyboard.press("Enter");
  // Le focus arrive sur le jour choisi une fois la fenêtre ouverte : les flèches partent de lui.
  await expect(page.locator(":focus")).toHaveAccessibleName("samedi 17 octobre 2026, sélectionné");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(dateField(page)).toHaveText("15 octobre 2026");
  await expect(page.locator(":focus")).toHaveAttribute("id", "playedOn");
});

test("Échap ferme le calendrier sans changer la date", async ({ page }) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  await dateField(page).click();
  await expect(calendar(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(calendar(page)).toHaveCount(0);
  await expect(dateField(page)).toHaveText("17 octobre 2026");
  await expect(page.locator(":focus")).toHaveAttribute("id", "playedOn");
});

test("chaque jour du calendrier fait au moins 44 px et la page ne défile pas en largeur", async ({
  page,
}) => {
  await page.goto(`/imports/${seedReadyImport()}`);
  await dateField(page).click();
  // Mesure après l'animation d'ouverture, qui part d'une échelle de 95 %.
  await page
    .locator('[data-slot="popover-content"]')
    .evaluate((popup) => Promise.all(popup.getAnimations().map(({ finished }) => finished)));
  // Octobre 2026 en semaines au lundi : du 28 septembre au 1er novembre, 35 jours.
  const days = calendar(page).getByRole("button");
  await expect(days).toHaveCount(35);
  for (const day of await days.all()) {
    const box = await day.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
  const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(widths[0]).toBeLessThanOrEqual(widths[1]);
});

test.describe("à Paris", () => {
  test.use({ timezoneId: "Europe/Paris" });

  test("le 13 choisi est la date du round enregistré", async ({ page }) => {
    await page.goto(`/imports/${seedReadyImport()}`);
    await pickDate(page, "2026-10-13");
    await saveButton(page).click();
    await page.waitForURL("**/rounds");
    const round = page.getByRole("listitem").filter({ hasText: "BETHPAGE BLACK" });
    await expect(round.locator("time")).toHaveText("13 octobre 2026");
    expect(roundDates()).toEqual(["2026-10-13"]);
  });
});

test.describe("à Toronto", () => {
  test.use({ timezoneId: "America/Toronto" });

  test("le round du 2026-10-17 s'affiche au 17 octobre, sélectionné dans le calendrier", async ({
    page,
    players,
  }) => {
    const id = seedRound(referenceRound(players, { playedOn: "2026-10-17" }));
    await page.goto(`/rounds/${id}/edit`);
    await expect(dateField(page)).toHaveText("17 octobre 2026");
    await dateField(page).click();
    await expect(selectedDay(page)).toHaveAttribute("data-day", "2026-10-17");
  });
});
