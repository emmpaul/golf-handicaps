import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("parseEnv", () => {
  it("refuse de démarrer sans APP_PASSCODE, avec un message qui nomme la variable", () => {
    expect(() => parseEnv({ SESSION_SECRET: SECRET })).toThrow(/APP_PASSCODE/);
  });

  it("refuse un APP_PASSCODE vide", () => {
    expect(() => parseEnv({ APP_PASSCODE: "", SESSION_SECRET: SECRET })).toThrow(/APP_PASSCODE/);
  });

  it("refuse de démarrer sans SESSION_SECRET, avec un message qui nomme la variable", () => {
    expect(() => parseEnv({ APP_PASSCODE: "birdie" })).toThrow(/SESSION_SECRET/);
  });

  it("refuse un SESSION_SECRET de moins de 32 caractères", () => {
    expect(() => parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: "x".repeat(31) })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it("nomme toutes les variables manquantes dans le même message", () => {
    expect(() => parseEnv({})).toThrow(/APP_PASSCODE[\s\S]*SESSION_SECRET/);
  });

  it.each([
    ["development", "./data"],
    ["test", "./data"],
    ["production", "/data"],
  ])("avec NODE_ENV=%s et sans DATA_DIR, DATA_DIR vaut %s", (nodeEnv, dataDir) => {
    expect(parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, NODE_ENV: nodeEnv })).toEqual(
      { APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, DATA_DIR: dataDir },
    );
  });

  it("garde le DATA_DIR fourni", () => {
    expect(
      parseEnv({
        APP_PASSCODE: "birdie",
        SESSION_SECRET: SECRET,
        DATA_DIR: "/srv/golf",
        NODE_ENV: "production",
      }),
    ).toEqual({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, DATA_DIR: "/srv/golf" });
  });
});
