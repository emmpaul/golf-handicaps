import { describe, expect, it } from "vitest";
import { contrast, hex } from "./palette";

// Mutation: dark --color-ink-2 set to the dark paper + 0.1 L, oklch(0.28 0.03 262) → the ink-2 and
// muted-foreground text pairs go red.
const textPairs = [
  ["foreground", "background"],
  ["foreground", "popover"],
  ["foreground", "accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "accent"],
  ["color-ink-3", "background"],
  ["color-ink-3", "muted"],
  ["primary-foreground", "primary"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["color-band-ink", "color-band"],
  ["birdie", "background"],
  ["birdie", "muted"],
  ["destructive", "background"],
  ["destructive", "muted"],
  ["background", "destructive"],
] as const;

// Non-text marks and edges: 3:1 (WCAG 1.4.11).
const markPairs = [
  ["bogey", "background"],
  ["ai", "background"],
  ["input", "background"],
  ["ring", "background"],
  ["ring", "muted"],
  ["ring", "accent"],
] as const;

describe("score-board palette contrast", () => {
  for (const mode of ["light", "dark"] as const) {
    for (const [fg, bg] of textPairs) {
      it(`${mode}: ${fg}/${bg} >= 4.5:1`, () => {
        expect(contrast(mode, fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    }
    for (const [fg, bg] of markPairs) {
      it(`${mode}: ${fg}/${bg} >= 3:1`, () => {
        expect(contrast(mode, fg, bg)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

// Values approved at gate 2.1 (picks.md), written by hand.
// Mutation: light --color-paper back to Fairway oklch(0.970031 0.008232 91.4826) → red.
describe("score-board palette values", () => {
  for (const [mode, name, expected] of [
    ["light", "background", "#F4F7FB"],
    ["dark", "background", "#0A111F"],
    ["light", "foreground", "#0F1D3E"],
    ["dark", "foreground", "#EAEFF4"],
    ["light", "primary", "#0F1D3E"],
    ["dark", "primary", "#EAEFF4"],
    ["light", "birdie", "#CB1E21"],
    ["dark", "birdie", "#F86B65"],
    ["light", "bogey", "#46566E"],
    ["dark", "bogey", "#A9B9CA"],
    ["light", "destructive", "#9B540C"],
    ["dark", "destructive", "#EB9854"],
    ["light", "color-band", "#0F1D3E"],
    ["dark", "color-band", "#223251"],
  ] as const) {
    it(`${mode}: --${name} is ${expected}`, () => {
      expect(hex(mode, name)).toBe(expected);
    });
  }
});
