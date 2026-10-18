import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_PASSCODE, E2E_SESSION_SECRET } from "./tests/e2e/session";

const PORT = Number(process.env.E2E_PORT ?? 3210);

// Dossier de données neuf par lancement, partagé par le web, le worker et les tests
// (les processus de test héritent de cette variable).
process.env.E2E_DATA_DIR ??= mkdtempSync(join(tmpdir(), "golf-e2e-"));

// En CI, les tranches reçoivent le build de l'app du job e2e-build (E2E_PREBUILT=1) et ne le refont pas.
// En local, le serveur web construit toujours l'app avant de démarrer.
const WEB_START = `pnpm start --hostname 127.0.0.1 --port ${PORT}`;
const webCommand = process.env.E2E_PREBUILT === "1" ? WEB_START : `pnpm build && ${WEB_START}`;

const serverEnv = {
  APP_PASSCODE: E2E_PASSCODE,
  SESSION_SECRET: E2E_SESSION_SECRET,
  DATA_DIR: process.env.E2E_DATA_DIR,
};

/** Parcours d'import, de correction et de prise de photo vérifiés aussi sur iPhone. */
const MOBILE_SPECS =
  /(access|ai-marking|app-shell|camera-capture|correction-autosave|date-picker|home|loading|mobile)\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  // Un seul serveur et une seule base par machine : les tests la remettent à zéro, donc un à
  // la fois. fullyParallel ne lance rien en parallèle ici, il permet seulement à `--shard` de
  // répartir les tests un par un entre les machines, et non par fichier entier.
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // En CI, le rapport json donne la durée de chaque test de la tranche (artefact playwright-durations-<n>).
  reporter: process.env.CI
    ? [["github"], ["json", { outputFile: "playwright-durations.json" }]]
    : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts$/ },
    { name: "webkit-iphone", use: { ...devices["iPhone 15"] }, testMatch: MOBILE_SPECS },
  ],
  webServer: [
    {
      name: "web",
      command: webCommand,
      url: `http://127.0.0.1:${PORT}/login`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: serverEnv,
    },
    {
      name: "worker",
      command: "pnpm exec tsx src/worker.ts",
      wait: { stdout: /\[worker\] Démarré/ },
      reuseExistingServer: false,
      timeout: 60_000,
      env: serverEnv,
    },
  ],
});
