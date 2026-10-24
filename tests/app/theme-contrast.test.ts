import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const light = css.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "";
const dark =
  css.match(/@media\s*\(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]+)\}/)?.[1] ?? "";

// OKLCH → linear sRGB. Contrast is measured before gamma encoding.
function rgb(block: string, token: string) {
  const value = block.match(new RegExp(`--${token}: oklch\\(([^)]+)\\)`))?.[1];
  if (!value) throw new Error(`Missing OKLCH token: ${token}`);
  const [l, c, hue] = value.split(/\s+/).map(Number);
  const a = c * Math.cos((hue * Math.PI) / 180);
  const b = c * Math.sin((hue * Math.PI) / 180);
  const x = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const y = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const z = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z,
    -1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z,
    -0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z,
  ];
}
function luminance(block: string, token: string) {
  const [r, g, b] = rgb(block, token);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("Fairway contrast", () => {
  for (const [mode, block] of [
    ["light", light],
    ["dark", dark],
  ]) {
    for (const [fg, bg] of [
      ["foreground", "background"],
      ["muted-foreground", "background"],
      ["primary-foreground", "primary"],
    ]) {
      // Mutation: dark --muted-foreground reset to oklch(0.45 0 0).
      it(`${mode}: ${fg}/${bg} >= 4.5:1`, () => {
        const a = luminance(block, fg);
        const b = luminance(block, bg);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("uses warm paper #F7F5EF", () => {
    const encoded = rgb(light, "background").map((v) =>
      Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)),
    );
    expect(encoded).toEqual([247, 245, 239]);
  });
});
