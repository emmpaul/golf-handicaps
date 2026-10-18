import { describe, expect, it } from "vitest";
import { attemptLogin, clientIp, createLoginGuard } from "@/lib/auth/login";
import { verifySessionToken } from "@/lib/auth/session";

const SECRET = "0123456789abcdef0123456789abcdef";
const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const config = { appPasscode: "birdie-42", sessionSecret: SECRET };

function login(passcode: string, guard = createLoginGuard(), ip = "203.0.113.7", now = NOW) {
  return attemptLogin({ passcode, ip, now }, { ...config, guard });
}

function exhaust(guard: ReturnType<typeof createLoginGuard>, ip: string) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    expect(login("faux", guard, ip, NOW + attempt)).toEqual({ ok: false, error: "Code incorrect" });
  }
}

describe("attemptLogin", () => {
  it("avec le bon code, crée une session valable", () => {
    const result = login("birdie-42");
    expect(result.ok).toBe(true);
    expect(result.ok && verifySessionToken(result.token, SECRET, NOW)).toBe(true);
  });

  it.each(["birdie-41", "BIRDIE-42", "birdie-42 ", "b", "", "birdie-42-et-plus"])(
    "avec le code %j, répond exactement « Code incorrect » sans session",
    (passcode) => {
      expect(login(passcode)).toEqual({ ok: false, error: "Code incorrect" });
    },
  );

  // 30 s pour les trois tests suivants : chacun fait 11 calculs scrypt synchrones, et en CI les
  // fichiers qui lancent Tesseract se disputent les 4 vCPU ; ils ont déjà pris plus de 5 s.
  it("au 11e essai dans la minute, refuse la requête même avec le bon code", () => {
    const guard = createLoginGuard();
    exhaust(guard, "203.0.113.7");
    expect(login("birdie-42", guard, "203.0.113.7", NOW + 11)).toEqual({
      ok: false,
      error: "Trop d'essais. Réessaie dans une minute.",
    });
  }, 30_000);

  it("compte les essais par IP", () => {
    const guard = createLoginGuard();
    exhaust(guard, "203.0.113.7");
    expect(login("birdie-42", guard, "198.51.100.9", NOW + 11).ok).toBe(true);
  }, 30_000);

  it("accepte de nouveau une minute après les 10 premiers essais", () => {
    const guard = createLoginGuard();
    exhaust(guard, "203.0.113.7");
    expect(login("birdie-42", guard, "203.0.113.7", NOW + 60_001).ok).toBe(true);
  }, 30_000);
});

describe("clientIp", () => {
  it.each([
    [{ "x-forwarded-for": "198.51.100.9" }, "198.51.100.9"],
    [{ "x-forwarded-for": "10.0.0.1, 198.51.100.9" }, "198.51.100.9"],
    [{ "x-real-ip": "198.51.100.10" }, "198.51.100.10"],
    [{}, "inconnue"],
  ])("lit l'IP vue par le proxy dans %j", (headers, ip) => {
    expect(clientIp(new Headers(headers))).toBe(ip);
  });
});
