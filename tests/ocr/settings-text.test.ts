import { describe, expect, it } from "vitest";
import { parsePlayedOn, parseTees } from "@/ocr/settings-text";

describe("parsePlayedOn", () => {
  it.each([
    ["DATE: 03/04/2026", "2026-03-04"],
    ["DATE: 10/17/2026", "2026-10-17"],
    ["GIMMES: 5\nDATE:3/4/2026 PLAY MODE", "2026-03-04"],
  ])("lit %j au format mois/jour/année : %s", (text, expected) => {
    expect(parsePlayedOn(text)).toBe(expected);
  });

  it.each([
    ["sans date", "GAME TYPE: STROKE PLAY"],
    ["mois 13 illisible", "DATE: 13/04/2026"],
    ["31 février", "DATE: 02/31/2026"],
  ])("rend null pour une date absente ou illisible (%s)", (_name, text) => {
    expect(parsePlayedOn(text)).toBe(null);
  });
});

describe("parseTees", () => {
  it("lit Red dans « TEES: Red 6241yd »", () => {
    expect(parseTees("STIMP: 8 TEES: Red 6241yd PINS: Thursday")).toBe("Red");
  });

  it("rend null sans tees", () => {
    expect(parseTees("STIMP: 8")).toBe(null);
  });
});
