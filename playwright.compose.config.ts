import { defineConfig, devices } from "@playwright/test";

/**
 * Test de fumée de l'image Docker (tâches 9.2 et 9.3) : vise l'app lancée par
 * `docker compose up --wait`, sans démarrer de serveur. `pnpm e2e:compose`.
 */
export default defineConfig({
  testDir: "./tests/compose",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.COMPOSE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
