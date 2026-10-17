import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { E2E_PASSCODE, E2E_SESSION_SECRET } from "./tests/e2e/session";

const PORT = Number(process.env.E2E_PORT ?? 3210);

// Dossier de données neuf par lancement, partagé par le web, le worker et les tests
// (les processus de test héritent de cette variable).
process.env.E2E_DATA_DIR ??= mkdtempSync(join(tmpdir(), "golf-e2e-"));

const serverEnv = {
  APP_PASSCODE: E2E_PASSCODE,
  SESSION_SECRET: E2E_SESSION_SECRET,
  DATA_DIR: process.env.E2E_DATA_DIR,
};

/** Parcours d'import, de correction et de prise de photo vérifiés aussi sur iPhone. */
const MOBILE_SPECS =
  /(access|ai-marking|camera-capture|correction-autosave|date-picker|home|mobile)\.spec\.ts$/;

export default defineConfig({
  testDir: "./tests/e2e",
  // Un seul serveur et une seule base par machine : les tests la remettent à zéro, donc un à
  // la fois. fullyParallel ne lance rien en parallèle ici, il permet seulement à `--shard` de
  // répartir les tests un par un entre les machines, et non par fichier entier.
  fullyParallel: true,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
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
      command: `pnpm build && pnpm start --hostname 127.0.0.1 --port ${PORT}`,
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
