import type { BrowserContext } from "@playwright/test";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../src/lib/auth/session";

export const E2E_PASSCODE = "e2e-code-du-groupe";
export const E2E_SESSION_SECRET = "e2e-secret-de-session-de-32-caracteres-min";

/** Ouvre une session sans passer par /login, pour ne pas consommer la limite de 10 essais/min. */
export async function authenticate(context: BrowserContext, baseURL: string | undefined) {
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: createSessionToken(E2E_SESSION_SECRET, Date.now()),
      url: baseURL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
