import { readFileSync } from "node:fs";

// Tokens (light in `@theme static`, dark in the media block) and the shadcn variables that point at them.
const tokens = readFileSync("src/app/tokens.css", "utf8");
const globals = readFileSync("src/app/globals.css", "utf8");

function declarations(block: string) {
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}
const lightTokens = declarations(tokens.match(/@theme static\s*\{([^}]+)\}/)?.[1] ?? "");
const darkTokens = declarations(
  tokens.match(/@media\s*\(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]+)\}/)?.[1] ?? "",
);
const shadcn = declarations(globals.match(/:root\s*\{([^}]+)\}/)?.[1] ?? "");

export type Mode = "light" | "dark";

/** Follows `var(--x)` from a shadcn variable or a token down to its OKLCH value in the given mode. */
function resolve(mode: Mode, name: string, depth = 0): string {
  if (depth > 8) throw new Error(`var() loop at --${name}`);
  const value =
    (mode === "dark" ? darkTokens.get(name) : undefined) ??
    lightTokens.get(name) ??
    shadcn.get(name);
  if (!value) throw new Error(`Undeclared variable: --${name}`);
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolve(mode, ref[1], depth + 1) : value;
}

/** OKLCH → linear sRGB. Contrast is measured before gamma encoding. */
function linear(mode: Mode, name: string) {
  const value = resolve(mode, name).match(/^oklch\(([^)]+)\)$/)?.[1];
  if (!value) throw new Error(`Not an OKLCH value: --${name}`);
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

/** WCAG 2 contrast ratio between two variables in the given mode. */
export function contrast(mode: Mode, fg: string, bg: string) {
  const lum = (name: string) => {
    const [r, g, b] = linear(mode, name);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** sRGB hex (`#RRGGBB`, upper case) of a variable in the given mode. */
export function hex(mode: Mode, name: string) {
  return `#${linear(mode, name)
    .map((v) => Math.min(1, Math.max(0, v)))
    .map((v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)))
    .map((v) => v.toString(16).padStart(2, "0").toUpperCase())
    .join("")}`;
}
