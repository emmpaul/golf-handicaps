import type { Page, Request } from "@playwright/test";
import {
  referenceRound,
  seedFailedImport,
  seedQueuedImport,
  seedReadyImport,
  seedRound,
  setImportStatus,
} from "./data";
import { saveButton } from "./editor";
import { expect, test } from "./fixtures";
import { chooseLargePhoto, choosePhoto } from "./import";
import { E2E_PASSCODE } from "./session";

/** Retard imposé aux réponses pour observer l'attente (jamais un `waitForTimeout` seul). */
const DELAY_MS = 1_000;

const wait = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

/**
 * Retarde de 1 s les requêtes `method` (POST par défaut, DELETE pour la suppression) vers `url`
 * qui satisfont `match`, puis les laisse partir au serveur.
 */
async function delayRequest(
  page: Page,
  url: string,
  method = "POST",
  match: (request: Request) => boolean = () => true,
) {
  await page.route(url, async (route) => {
    const request = route.request();
    if (request.method() === method && match(request)) await wait();
    await route.continue();
  });
}

/** Retarde de 1 s l'action serveur postée vers la page `url` : le POST qui porte l'en-tête `next-action`. */
const delayServerAction = (page: Page, url: string) =>
  delayRequest(page, url, "POST", (request) => request.headers()["next-action"] !== undefined);

/**
 * Région d'attente qui affiche `label`. Chaque attente garde sa région montée, vide au repos :
 * une page en compte souvent plusieurs, on retient celle qui porte le texte.
 */
const waitingFor = (page: Page, label: string) =>
  page.getByRole("status").filter({ hasText: label });

/** Ouvre l'écran de recadrage d'un import en échec, photo chargée. */
async function openRecrop(page: Page) {
  const id = seedFailedImport();
  await page.goto(`/imports/${id}/recadrer`);
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toBeVisible();
}

const validateCrop = (page: Page) => page.getByRole("button", { name: "Valider le cadrage" });

/** Valide le cadrage, attend l'aperçu redressé puis clique sur « Lancer la lecture ». */
async function launchReading(page: Page) {
  await validateCrop(page).click();
  await expect(page.getByRole("img", { name: "Carte redressée" })).toBeVisible();
  await page.getByRole("button", { name: "Lancer la lecture" }).click();
}

test("l'envoi d'une photo cadrée affiche « Envoi de la photo… » jusqu'à sa mise en file", async ({
  page,
}, testInfo) => {
  // Sous WebKit, une requête interceptée par `page.route` perd la partie Blob du FormData :
  // le serveur répond 400 « Photo manquante ».
  test.skip(testInfo.project.name === "webkit-iphone", "limite de page.route sous WebKit");
  await delayRequest(page, "**/api/imports");
  await page.goto("/import");
  await choosePhoto(page);
  await launchReading(page);

  const sending = waitingFor(page, "Envoi de la photo…");
  await expect(sending).toHaveText("Envoi de la photo…");
  await expect(sending.locator("canvas")).toHaveAttribute("aria-hidden", "true");
  await expect(sending).toHaveCount(0);
  await expect(
    page.getByText("Lecture en file d'attente. Tu peux envoyer la photo suivante."),
  ).toBeVisible();
});

test("le redressement de l'aperçu affiche « Redressement de la photo… », boutons désactivés", async ({
  page,
}) => {
  // `rectifyPreview` recharge la photo par `new Image()`, que Chromium sert depuis sa mémoire
  // sans requête, même en `no-store` : on retarde donc d'1 s le chargement de ces images-là.
  await page.addInitScript((ms) => {
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    const NativeImage = window.Image;
    // biome-ignore lint/complexity/useArrowFunction: `new Image()` exige une fonction constructible.
    window.Image = function (width?: number, height?: number) {
      const image = new NativeImage(width, height);
      Object.defineProperty(image, "src", {
        get: () => src?.get?.call(image),
        set: (url: string) => setTimeout(() => src?.set?.call(image, url), ms),
      });
      return image;
    } as unknown as typeof Image;
  }, DELAY_MS);
  await openRecrop(page);
  await validateCrop(page).click();

  const rectifying = waitingFor(page, "Redressement de la photo…");
  await expect(rectifying).toHaveText("Redressement de la photo…");
  await expect(validateCrop(page)).toBeDisabled();
  await expect(page.getByRole("img", { name: "Carte redressée" })).toBeVisible();
  await expect(rectifying).toHaveCount(0);
});

test("une photo en préparation affiche « Préparation de la photo… » avant le cadrage", async ({
  page,
}) => {
  // Décodage ralenti : `createImageBitmap` attend 1 s avant l'appel d'origine.
  await page.addInitScript((ms) => {
    const original = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return original(...args);
    }) as typeof createImageBitmap;
  }, DELAY_MS);
  await page.goto("/import");
  await chooseLargePhoto(page);

  const preparing = waitingFor(page, "Préparation de la photo…");
  await expect(preparing).toHaveText("Préparation de la photo…");
  await expect(page.getByRole("img", { name: "Carte à cadrer" })).toBeVisible();
  await expect(preparing).toHaveCount(0);
});

test("le recadrage d'un import en échec affiche « Envoi de la photo… » pendant l'envoi", async ({
  page,
}) => {
  await delayRequest(page, "**/api/imports/*/corners");
  await openRecrop(page);
  await launchReading(page);

  await expect(waitingFor(page, "Envoi de la photo…")).toHaveText("Envoi de la photo…");
  await page.waitForURL("**/import");
});

/** Ligne de la liste des imports pour l'import `id`. */
const importRow = (page: Page, id: number) =>
  page
    .getByRole("list", { name: "Imports" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: `Import n°${id}` }) });

test("un import sans job reste « En attente » après trois rafraîchissements de la liste", async ({
  page,
}) => {
  const id = seedQueuedImport("queued");
  await page.goto("/import");
  const status = importRow(page, id).getByTestId("import-status");
  // La liste se recharge toutes les 2 s : trois réponses couvrent plus de 5 s.
  for (let i = 0; i < 3; i++) {
    await page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/imports") && response.request().method() === "GET",
    );
    await expect(status).toHaveText("En attente");
  }
});

test("seul un import en lecture affiche l'orbe, qui disparaît une fois prêt", async ({ page }) => {
  const ready = seedReadyImport();
  const reading = seedQueuedImport("reading");
  await page.goto("/import");

  await expect(importRow(page, reading).getByTestId("import-status")).toHaveText(
    "Lecture en cours",
  );
  await expect(importRow(page, reading).locator("canvas")).toHaveAttribute("aria-hidden", "true");
  await expect(importRow(page, ready).getByTestId("import-status")).toHaveText("Prêt à vérifier");
  await expect(importRow(page, ready).locator("canvas")).toHaveCount(0);

  setImportStatus(reading, "ready");
  await expect(importRow(page, reading).getByTestId("import-status")).toHaveText("Prêt à vérifier");
  await expect(importRow(page, reading).locator("canvas")).toHaveCount(0);
});

/** Deux images de l'orbe de la ligne `id`, prises à 300 ms d'écart après son premier dessin. */
async function orbFrames(page: Page, id: number) {
  const canvas = importRow(page, id).locator("canvas");
  await expect(canvas).toBeVisible();
  return canvas.evaluate(async (element: HTMLCanvasElement) => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame();
    await frame();
    const first = element.toDataURL();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return [first, element.toDataURL()];
  });
}

test("avec « réduire les animations », l'orbe d'un import en lecture reste immobile", async ({
  page,
}) => {
  const id = seedQueuedImport("reading");
  await page.goto("/import");
  const [before, after] = await orbFrames(page, id);
  expect(after).not.toBe(before);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const [still, later] = await orbFrames(page, id);
  expect(later).toBe(still);
  await expect(importRow(page, id).getByTestId("import-status")).toHaveText("Lecture en cours");
});

test("l'enregistrement d'un round affiche « Enregistrement du round… » jusqu'à la liste des rounds", async ({
  page,
}) => {
  await delayRequest(page, "**/api/rounds");
  // Navigation vers /rounds retardée aussi : l'indicateur doit tenir jusqu'à son arrivée.
  await page.route(
    (url) => url.pathname === "/rounds",
    async (route) => {
      await wait();
      await route.continue();
    },
  );
  await page.goto(`/imports/${seedReadyImport()}`);
  await saveButton(page).click();

  const saving = waitingFor(page, "Enregistrement du round…");
  await expect(saving).toHaveText("Enregistrement du round…");
  await expect(saveButton(page)).toBeDisabled();
  // Round enregistré, page suivante pas encore arrivée : rien ne bouge.
  await page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/rounds" &&
      request.headers()["next-router-prefetch"] === undefined,
  );
  await expect(saving).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
  await page.waitForURL("**/rounds");
});

test("la création d'un joueur depuis une ligne affiche « Création du joueur… »", async ({
  page,
}) => {
  const id = seedReadyImport();
  // L'action serveur part en POST vers l'URL de la page.
  await delayServerAction(page, `**/imports/${id}`);
  await page.goto(`/imports/${id}`);
  await page.getByLabel("Joueur de la ligne 1").selectOption({ label: "Nouveau joueur…" });
  await page.getByLabel("Nom du nouveau joueur de la ligne 1").fill("Julien");
  await page.getByRole("button", { name: "Créer le joueur de la ligne 1" }).click();

  const creating = waitingFor(page, "Création du joueur…");
  await expect(creating).toHaveText("Création du joueur…");
  await expect(page.getByLabel("Joueur de la ligne 1").locator("option:checked")).toHaveText(
    "Julien",
  );
  await expect(creating).toHaveCount(0);
});

test("l'ouverture de session annonce « Connexion… » dans une région présente et vide avant le clic", async ({
  page,
}) => {
  await delayServerAction(page, "**/login");
  await page.goto("/login");
  await page.getByLabel("Code d'accès").fill(E2E_PASSCODE);
  // Région montée avant l'attente : VoiceOver n'annonce pas une région insérée déjà remplie.
  const status = page.getByRole("status");
  await expect(status).toHaveText("");
  await page.getByRole("button", { name: "Entrer" }).click();

  await expect(status).toHaveText("Connexion…");
  await page.waitForURL((url) => url.pathname === "/");
});

test("l'ajout d'un joueur affiche « Enregistrement du joueur… » jusqu'à son arrivée", async ({
  page,
}) => {
  await delayServerAction(page, "**/players");
  await page.goto("/players");
  await page.getByLabel("Nouveau joueur").fill("Julien");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();

  // Un formulaire par joueur, chacun avec sa région : seule compte celle de l'ajout.
  const status = page
    .locator("form")
    .filter({ has: page.getByLabel("Nouveau joueur", { exact: true }) })
    .getByRole("status");
  await expect(status).toHaveText("Enregistrement du joueur…");
  await expect(
    page.getByRole("list", { name: "Joueurs" }).getByRole("heading", { name: "Julien" }),
  ).toBeVisible();
  await expect(status).toHaveText("");
});

test("la suppression d'un round affiche « Suppression du round… » dans la confirmation", async ({
  page,
  players,
}) => {
  const id = seedRound(referenceRound(players));
  await delayRequest(page, `**/api/rounds/${id}`, "DELETE");
  await page.goto(`/rounds/${id}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Supprimer ce round ?" });
  await dialog.getByRole("button", { name: "Supprimer" }).click();

  await expect(dialog.getByRole("status")).toHaveText("Suppression du round…");
  await page.waitForURL("**/rounds");
});
