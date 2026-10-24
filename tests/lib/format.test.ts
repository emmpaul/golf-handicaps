import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formatSignedTenths, isoToLocalDate, localDateToIso } from "@/lib/format";

const ORIGINAL_TZ = process.env.TZ;

function inTimeZone(timeZone: string) {
  beforeAll(() => {
    process.env.TZ = timeZone;
  });
  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ;
    else process.env.TZ = ORIGINAL_TZ;
  });
}

describe("isoToLocalDate à l'heure de Toronto", () => {
  inTimeZone("America/Toronto");

  it("tourne bien dans le fuseau de Toronto (UTC-4 en octobre)", () => {
    expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(240);
  });

  it("lit 2026-10-17 comme le 17 octobre local, pas le 16 au soir", () => {
    const date = isoToLocalDate("2026-10-17");
    expect(date.getDate()).toBe(17);
    expect(date.getMonth()).toBe(9);
  });
});

describe("localDateToIso à l'heure de Paris", () => {
  inTimeZone("Europe/Paris");

  it("tourne bien dans le fuseau de Paris (UTC+2 en octobre)", () => {
    expect(new Date(2026, 9, 17).getTimezoneOffset()).toBe(-120);
  });

  it("écrit le 13 octobre local comme 2026-10-13, pas la veille", () => {
    expect(localDateToIso(new Date(2026, 9, 13))).toBe("2026-10-13");
  });

  it("garde les zéros de tête du mois et du jour", () => {
    expect(localDateToIso(new Date(2025, 2, 4))).toBe("2025-03-04");
  });
});

// Mutation: ASCII hyphen instead of U+2212.
it.each([
  [3, "+0,3"],
  [-3, "−0,3"],
  [0, "="],
  [158, "+15,8"],
] as const)("signed tenths %i → %s", (value, expected) => {
  expect(formatSignedTenths(value)).toBe(expected);
});
