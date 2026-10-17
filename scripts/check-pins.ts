import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
};

const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const EXACT_PACKAGE_MANAGER =
  /^[a-z]+@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[a-z0-9]+\.[0-9a-f]+)?$/;
const DEPENDENCY_FIELDS = ["dependencies", "devDependencies"] as const;

export function findUnpinned(pkg: PackageJson): string[] {
  const unpinned = DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(pkg[field] ?? {})
      .filter(([, version]) => !EXACT_VERSION.test(version))
      .map(([name, version]) => `${field}.${name}: ${version}`),
  );
  if (pkg.packageManager !== undefined && !EXACT_PACKAGE_MANAGER.test(pkg.packageManager)) {
    unpinned.push(`packageManager: ${pkg.packageManager}`);
  }
  return unpinned;
}

function main(): void {
  const path = resolve(process.argv[2] ?? "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  const unpinned = findUnpinned(pkg);
  if (unpinned.length > 0) {
    console.error(`Versions non exactes dans ${path} :`);
    for (const entry of unpinned) console.error(`  - ${entry}`);
    process.exit(1);
  }
  console.info("Toutes les versions sont exactes.");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
