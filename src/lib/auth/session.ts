import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export const SESSION_COOKIE_NAME = "golf_session";

/**
 * Secure seulement en production (HTTPS derrière Dokploy). En dev, Safari et les téléphones
 * en http://<IP du LAN> rejettent un cookie Secure : la connexion bouclerait sur /login.
 */
export function sessionCookieOptions(nodeEnv: string | undefined) {
  return {
    httpOnly: true,
    secure: nodeEnv === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  } as const;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Jeton `<expiration en ms>.<HMAC-SHA256 base64url>`, valable 90 jours à partir de `now`. */
export function createSessionToken(secret: string, now: number): string {
  const payload = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number,
): boolean {
  const match = /^(\d+)\.([\w-]+)$/.exec(token ?? "");
  if (!match) {
    return false;
  }
  const [, payload, signature] = match;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return false;
  }
  return now < Number(payload);
}
