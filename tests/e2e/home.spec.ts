import { expect, test } from "@playwright/test";
import packageJson from "../../package.json";
import { authenticate } from "./session";

test("la page d'accueil affiche le titre de l'app en français", async ({
  page,
  context,
  baseURL,
}) => {
  await authenticate(context, baseURL);
  await page.goto("/");
  await expect(page).toHaveTitle("Handicaps golf");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Handicaps golf");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("la page d'accueil montre la version seule en pied de page (build e2e sans commit)", async ({
  page,
  context,
  baseURL,
}) => {
  await authenticate(context, baseURL);
  await page.goto("/");
  // La release change la version de `package.json` : le texte attendu la suit. Nom exact :
  // un « · <commit> » ne correspondrait pas.
  const version = page.getByRole("link", { name: `v${packageJson.version}`, exact: true });
  await expect(version).toHaveAttribute(
    "href",
    `https://github.com/emmpaul/golf-handicaps/releases/tag/v${packageJson.version}`,
  );
});
