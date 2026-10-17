import { expect, test } from "@playwright/test";
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
