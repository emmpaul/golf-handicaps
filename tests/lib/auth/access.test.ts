import { describe, expect, it } from "vitest";
import { decideAccess } from "@/lib/auth/access";
import { createSessionToken } from "@/lib/auth/session";

const SECRET = "0123456789abcdef0123456789abcdef";
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const VALID = createSessionToken(SECRET, NOW);

describe("decideAccess", () => {
  it.each([
    ["GET", "/login", undefined, "allow"],
    ["POST", "/login", undefined, "allow"],
    ["GET", "/", undefined, "redirect-login"],
    ["GET", "/rounds/12", undefined, "redirect-login"],
    ["GET", "/loginx", undefined, "redirect-login"],
    ["GET", "/", "faux.jeton", "redirect-login"],
    ["POST", "/", undefined, "unauthorized"],
    ["POST", "/api/rounds", undefined, "unauthorized"],
    ["GET", "/api/photos/abc.jpg", undefined, "unauthorized"],
    ["POST", "/api/imports/1/corners", undefined, "unauthorized"],
    ["DELETE", "/rounds/12", undefined, "unauthorized"],
    ["GET", "/manifest.webmanifest", undefined, "allow"],
    ["GET", "/apple-icon", undefined, "allow"],
    ["GET", "/icon/192", undefined, "allow"],
    ["GET", "/icon/512", undefined, "allow"],
    ["GET", "/manifest.webmanifest/x", undefined, "redirect-login"],
    ["GET", "/icon-admin", undefined, "redirect-login"],
    ["GET", "/icon/1024", undefined, "redirect-login"],
    ["POST", "/manifest.webmanifest", undefined, "unauthorized"],
    ["GET", "/", VALID, "allow"],
    ["POST", "/api/rounds", VALID, "allow"],
  ])("%s %s avec le jeton %j : %s", (method, pathname, token, decision) => {
    expect(decideAccess({ method, pathname, token, secret: SECRET, now: NOW })).toBe(decision);
  });

  it("refuse un jeton expiré comme une absence de session", () => {
    const expired = createSessionToken(SECRET, NOW - 91 * 24 * 60 * 60 * 1000);
    expect(
      decideAccess({ method: "GET", pathname: "/", token: expired, secret: SECRET, now: NOW }),
    ).toBe("redirect-login");
  });
});
