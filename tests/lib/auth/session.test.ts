import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session";

const SECRET = "0123456789abcdef0123456789abcdef";
const ISSUED_AT = Date.UTC(2026, 9, 17, 12, 0, 0);
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

describe("jeton de session", () => {
  it("accepte un jeton valide signé avec le même secret", () => {
    const token = createSessionToken(SECRET, ISSUED_AT);
    expect(verifySessionToken(token, SECRET, ISSUED_AT + 1000)).toBe(true);
  });

  it("accepte encore le jeton 1 ms avant les 90 jours", () => {
    const token = createSessionToken(SECRET, ISSUED_AT);
    expect(verifySessionToken(token, SECRET, ISSUED_AT + NINETY_DAYS_MS - 1)).toBe(true);
  });

  it("refuse le jeton expiré, à 90 jours pile", () => {
    const token = createSessionToken(SECRET, ISSUED_AT);
    expect(verifySessionToken(token, SECRET, ISSUED_AT + NINETY_DAYS_MS)).toBe(false);
  });

  it("refuse un jeton dont l'expiration a été repoussée à la main", () => {
    const token = createSessionToken(SECRET, ISSUED_AT);
    const signature = token.split(".")[1];
    const tampered = `${ISSUED_AT + 10 * NINETY_DAYS_MS}.${signature}`;
    expect(verifySessionToken(tampered, SECRET, ISSUED_AT + 2 * NINETY_DAYS_MS)).toBe(false);
  });

  it("refuse un jeton dont la signature a été modifiée", () => {
    const token = createSessionToken(SECRET, ISSUED_AT);
    const last = token.at(-1) === "A" ? "B" : "A";
    expect(verifySessionToken(`${token.slice(0, -1)}${last}`, SECRET, ISSUED_AT)).toBe(false);
  });

  it("refuse un jeton signé avec un autre secret", () => {
    const token = createSessionToken("fedcba9876543210fedcba9876543210", ISSUED_AT);
    expect(verifySessionToken(token, SECRET, ISSUED_AT)).toBe(false);
  });

  it.each([undefined, "", "n'importe quoi", "123", ".", "abc.def.ghi"])(
    "refuse le jeton mal formé %j",
    (token) => {
      expect(verifySessionToken(token, SECRET, ISSUED_AT)).toBe(false);
    },
  );

  it("pose en production un cookie httpOnly, Secure, SameSite=Lax, valable 90 jours sur tout le site", () => {
    expect(SESSION_COOKIE_NAME).toBe("golf_session");
    expect(sessionCookieOptions("production")).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7_776_000,
    });
  });

  it.each(["development", "test", undefined])(
    "pose hors production (%j) un cookie sans Secure, pour http://localhost et le réseau local",
    (nodeEnv) => {
      expect(sessionCookieOptions(nodeEnv)).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 7_776_000,
      });
    },
  );
});
