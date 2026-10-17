import { expect, test } from "@playwright/test";
import { E2E_PASSCODE } from "./session";

test("sans session, la page d'accueil redirige vers /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Code d'accès")).toBeVisible();
});

for (const [label, path] of [
  ["l'écriture d'un round", "/api/rounds"],
  ["une server action", "/"],
]) {
  test(`sans session, ${label} (POST ${path}) renvoie 401`, async ({ request }) => {
    const response = await request.post(path, { data: { course: "Bethpage Black" } });
    expect(response.status()).toBe(401);
  });
}

test("avec un code faux, affiche « Code incorrect » et reste sur /login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Code d'accès").fill("pas-le-bon-code");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Code incorrect");
  await expect(page).toHaveURL(/\/login$/);
});

test("avec le bon code, ouvre une session et affiche l'accueil", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Code d'accès").fill(E2E_PASSCODE);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/login",
  );
  await page.getByRole("button", { name: "Entrer" }).click();
  // Le cookie est lu dans l'en-tête Set-Cookie et non dans context.cookies() : WebKit sous Linux
  // ne stocke pas un cookie Secure reçu en http://127.0.0.1, alors que la prod est en HTTPS.
  const setCookie = await (await loginResponse).headerValue("set-cookie");
  const [nameValue, ...attributes] = (setCookie ?? "").split("; ");
  expect(nameValue).toMatch(/^golf_session=\d+\.[\w-]+$/);
  expect(attributes.filter((attribute) => !attribute.startsWith("Expires=")).sort()).toEqual([
    "HttpOnly",
    "Max-Age=7776000",
    "Path=/",
    "SameSite=lax",
    "Secure",
  ]);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Handicaps golf");
});
