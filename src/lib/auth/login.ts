import { createHash, timingSafeEqual } from "node:crypto";
import { createSessionToken } from "./session";

export const WRONG_PASSCODE = "Code incorrect";
export const TOO_MANY_ATTEMPTS = "Trop d'essais. Réessaie dans une minute.";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60_000;

export type LoginResult = { ok: true; token: string } | { ok: false; error: string };
export type LoginGuard = { allow(ip: string, now: number): boolean };

/** Limite en mémoire : 10 essais par fenêtre glissante d'une minute et par IP. */
export function createLoginGuard(): LoginGuard {
  const attempts = new Map<string, number[]>();
  return {
    allow(ip, now) {
      const recent = (attempts.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
      recent.push(now);
      attempts.set(ip, recent);
      return recent.length <= MAX_ATTEMPTS;
    },
  };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function attemptLogin(
  attempt: { passcode: string; ip: string; now: number },
  deps: { appPasscode: string; sessionSecret: string; guard: LoginGuard },
): LoginResult {
  if (!deps.guard.allow(attempt.ip, attempt.now)) {
    return { ok: false, error: TOO_MANY_ATTEMPTS };
  }
  // Des empreintes de même longueur permettent timingSafeEqual quelle que soit la saisie.
  if (!timingSafeEqual(digest(attempt.passcode), digest(deps.appPasscode))) {
    return { ok: false, error: WRONG_PASSCODE };
  }
  return { ok: true, token: createSessionToken(deps.sessionSecret, attempt.now) };
}

/** IP du client telle que l'ajoute le reverse proxy (dernière entrée de X-Forwarded-For). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return forwarded || headers.get("x-real-ip") || "inconnue";
}
