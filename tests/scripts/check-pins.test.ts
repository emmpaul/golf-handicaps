import { describe, expect, it } from "vitest";
import { findUnpinned } from "../../scripts/check-pins";

describe("findUnpinned", () => {
  it("accepte un package.json dont toutes les versions sont exactes", () => {
    expect(
      findUnpinned({
        dependencies: { next: "16.4.2", zod: "4.0.0-beta.1" },
        devDependencies: { vitest: "5.0.5" },
        packageManager: "pnpm@12.14.0+sha512.c18ba6d8",
      }),
    ).toEqual([]);
  });

  it.each([
    ["dependencies", "^16.4.2"],
    ["dependencies", "~16.4.2"],
    ["dependencies", "latest"],
    ["dependencies", "*"],
    ["dependencies", ">=16.0.0"],
    ["dependencies", "16.x"],
    ["dependencies", "16"],
    ["devDependencies", "^5.0.5"],
    ["devDependencies", "16.4.2 || 17.0.0"],
  ])("signale %s.next à %s", (field, version) => {
    expect(findUnpinned({ [field]: { next: version } })).toEqual([`${field}.next: ${version}`]);
  });

  it.each(["pnpm@^12.14.0", "pnpm@12", "pnpm@latest", "pnpm"])(
    "signale packageManager %s",
    (packageManager) => {
      expect(findUnpinned({ packageManager })).toEqual([`packageManager: ${packageManager}`]);
    },
  );

  it("liste chaque version non exacte, dans l'ordre des champs", () => {
    expect(
      findUnpinned({
        dependencies: { next: "16.4.2", react: "^19.3.1" },
        devDependencies: { vitest: "~5.0.5" },
        packageManager: "pnpm@^12.14.0",
      }),
    ).toEqual([
      "dependencies.react: ^19.3.1",
      "devDependencies.vitest: ~5.0.5",
      "packageManager: pnpm@^12.14.0",
    ]);
  });
});
