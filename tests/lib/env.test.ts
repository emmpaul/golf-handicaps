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
      {
        APP_PASSCODE: "birdie",
        SESSION_SECRET: SECRET,
        DATA_DIR: dataDir,
        ANTHROPIC_API_KEY: null,
        AI_MONTHLY_BUDGET_USD: 1,
        INITIAL_PLAYERS: [],
        AI_BUDGET_TIME_ZONE: "America/Montreal",
      },
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
    ).toEqual({
      APP_PASSCODE: "birdie",
      SESSION_SECRET: SECRET,
      DATA_DIR: "/srv/golf",
      ANTHROPIC_API_KEY: null,
      AI_MONTHLY_BUDGET_USD: 1,
      INITIAL_PLAYERS: [],
      AI_BUDGET_TIME_ZONE: "America/Montreal",
    });
  });

  it("sans ANTHROPIC_API_KEY ni AI_MONTHLY_BUDGET_USD, la clé vaut null et le budget 1", () => {
    const env = parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET });
    expect(env.ANTHROPIC_API_KEY).toBeNull();
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(1);
  });

  it("traite une ANTHROPIC_API_KEY vide comme absente", () => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, ANTHROPIC_API_KEY: "" })
        .ANTHROPIC_API_KEY,
    ).toBeNull();
  });

  it("garde l'ANTHROPIC_API_KEY fournie", () => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, ANTHROPIC_API_KEY: "sk-ant-test" })
        .ANTHROPIC_API_KEY,
    ).toBe("sk-ant-test");
  });

  // Mutation : `z.coerce.number()` direct, qui lit "" comme 0 et refuse le démarrage.
  it("traite un AI_MONTHLY_BUDGET_USD vide comme absent : budget 1", () => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, AI_MONTHLY_BUDGET_USD: "" })
        .AI_MONTHLY_BUDGET_USD,
    ).toBe(1);
  });

  it("lit AI_MONTHLY_BUDGET_USD comme un nombre", () => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, AI_MONTHLY_BUDGET_USD: "2.5" })
        .AI_MONTHLY_BUDGET_USD,
    ).toBe(2.5);
  });

  it.each(["abc", "0", "-1"])(
    "refuse AI_MONTHLY_BUDGET_USD=%s, avec un message qui nomme la variable",
    (budget) => {
      expect(() =>
        parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, AI_MONTHLY_BUDGET_USD: budget }),
      ).toThrow(/AI_MONTHLY_BUDGET_USD/);
    },
  );

  it("découpe INITIAL_PLAYERS sur les virgules et retire les espaces autour", () => {
    expect(
      parseEnv({
        APP_PASSCODE: "birdie",
        SESSION_SECRET: SECRET,
        INITIAL_PLAYERS: "Manu, Gab,Sean",
      }).INITIAL_PLAYERS,
    ).toEqual(["Manu", "Gab", "Sean"]);
  });

  it("ignore les noms vides de INITIAL_PLAYERS", () => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, INITIAL_PLAYERS: " , Gab ,, " })
        .INITIAL_PLAYERS,
    ).toEqual(["Gab"]);
  });

  it.each([
    ["absente", undefined],
    ["vide", ""],
  ])("INITIAL_PLAYERS %s : aucun joueur", (_label, value) => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, INITIAL_PLAYERS: value })
        .INITIAL_PLAYERS,
    ).toEqual([]);
  });

  // Mutation : comparer les doublons avec la casse laisse passer "Gab,gab".
  it("refuse deux noms identiques sans la casse, avec un message qui nomme INITIAL_PLAYERS", () => {
    expect(() =>
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, INITIAL_PLAYERS: "Gab,gab" }),
    ).toThrow(/INITIAL_PLAYERS/);
  });

  // Mutation : valider avec `Intl.supportedValuesOf("timeZone")`, qui ignore le lien America/Montreal.
  it.each([
    ["absente", undefined],
    ["vide", ""],
  ])("AI_BUDGET_TIME_ZONE %s : America/Montreal", (_label, value) => {
    expect(
      parseEnv({ APP_PASSCODE: "birdie", SESSION_SECRET: SECRET, AI_BUDGET_TIME_ZONE: value })
        .AI_BUDGET_TIME_ZONE,
    ).toBe("America/Montreal");
  });

  it("garde l'AI_BUDGET_TIME_ZONE fourni", () => {
    expect(
      parseEnv({
        APP_PASSCODE: "birdie",
        SESSION_SECRET: SECRET,
        AI_BUDGET_TIME_ZONE: "Europe/Paris",
      }).AI_BUDGET_TIME_ZONE,
    ).toBe("Europe/Paris");
  });

  it("refuse un fuseau inconnu, avec un message qui nomme AI_BUDGET_TIME_ZONE", () => {
    expect(() =>
      parseEnv({
        APP_PASSCODE: "birdie",
        SESSION_SECRET: SECRET,
        AI_BUDGET_TIME_ZONE: "Mars/Olympus",
      }),
    ).toThrow(/AI_BUDGET_TIME_ZONE/);
  });
});
