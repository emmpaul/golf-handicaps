import { expect, test } from "@playwright/test";
import packageJson from "../../package.json";
import { authenticate, E2E_PASSCODE } from "./session";

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

test("sans session, GET /api/version répond 200 sans commit (build e2e sans GIT_COMMIT)", async ({
  request,
}) => {
  const response = await request.get("/api/version");
  expect(response.status()).toBe(200);
  expect((await response.json()).commit).toBeNull();
});

test("sans session, POST /api/version renvoie 401", async ({ request }) => {
  const response = await request.post("/api/version");
  expect(response.status()).toBe(401);
});

test("/login montre la version seule en pied de page (build e2e sans commit)", async ({ page }) => {
  await page.goto("/login");
  // La release change la version de `package.json` : le texte attendu la suit. Nom exact :
  // un « · <commit> » ne correspondrait pas.
  const version = page.getByRole("link", { name: `v${packageJson.version}`, exact: true });
  await expect(version).toHaveAttribute(
    "href",
    `https://github.com/emmpaul/golf-handicaps/releases/tag/v${packageJson.version}`,
  );
});

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

test("« Se déconnecter » ferme la session de ce navigateur, pas celle d'un autre appareil", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await authenticate(context, baseURL);
  const otherDevice = await browser.newContext({ baseURL });
  await authenticate(otherDevice, baseURL);

  await page.goto("/");
  await page.getByRole("button", { name: "Se déconnecter", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  // Mutation : une action qui redirige sans supprimer le cookie fait rougir cette ligne, et sans
  // elle le `goto("/")` suivant, qui reste sur l'accueil.
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("golf_session");

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  const response = await page.request.post("/api/rounds", { data: { course: "Bethpage Black" } });
  expect(response.status()).toBe(401);

  const otherPage = await otherDevice.newPage();
  await otherPage.goto("/");
  await expect(otherPage).toHaveURL(/\/$/);
  await expect(otherPage.getByRole("heading", { level: 1 })).toHaveText("Handicaps golf");
  await otherDevice.close();
});
