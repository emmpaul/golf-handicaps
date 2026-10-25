import { describe, expect, it } from "vitest";
import { BRAND_COLORS } from "@/app/brand-colors";
import { hex, type Mode } from "./palette";

// `next/og`, `themeColor` and the manifest cannot read CSS: `brand-colors.ts` copies the token hex
// values (design D5). Each copy must match its token in `tokens.css`, light or dark.
// Mutation: light --color-ink changed in `tokens.css` to oklch(0.3 0.065 264) without touching
// `brand-colors.ts` → "ink" goes red.
const SOURCES: Record<keyof typeof BRAND_COLORS, [Mode, string]> = {
  paper: ["light", "color-paper"],
  paperDark: ["dark", "color-paper"],
  ink: ["light", "color-ink"],
  ink2: ["light", "color-ink-2"],
  signal: ["light", "color-signal"],
};

describe("brand colours follow tokens.css", () => {
  it("names exactly the colours the icons, theme-color and manifest use", () => {
    expect(Object.keys(BRAND_COLORS).sort()).toEqual([
      "ink",
      "ink2",
      "paper",
      "paperDark",
      "signal",
    ]);
  });

  for (const [key, [mode, token]] of Object.entries(SOURCES)) {
    it(`${key} equals ${mode} --${token}`, () => {
      expect(BRAND_COLORS[key as keyof typeof BRAND_COLORS]).toBe(hex(mode, token));
    });
  }
});
