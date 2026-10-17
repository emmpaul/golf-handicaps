import { readFileSync } from "node:fs";
import { isDeepStrictEqual, parseArgs } from "node:util";

export function onlyVersionChanged(before: string, after: string): boolean {
  try {
    const { version: _b, ...restBefore } = JSON.parse(before);
    const { version: _a, ...restAfter } = JSON.parse(after);
    return isDeepStrictEqual(restBefore, restAfter);
  } catch {
    return false;
  }
}

function isDocsPath(path: string, packageJsonVersionOnly: boolean): boolean {
  return (
    path.startsWith("openspec/") ||
    path.startsWith("docs/") ||
    path.endsWith(".md") ||
    path === ".release-please-manifest.json" ||
    (path === "package.json" && packageJsonVersionOnly)
  );
}

export function isDocsOnly(paths: string[], packageJsonVersionOnly: boolean): boolean {
  return paths.length > 0 && paths.every((path) => isDocsPath(path, packageJsonVersionOnly));
}

type Scope = {
  docsOnly: boolean;
  event: string;
  parentConclusion: string | null;
};

export function decideScope({ docsOnly, event, parentConclusion }: Scope): "true" | "false" {
  if (!docsOnly) return "true";
  if (event === "push" && parentConclusion !== "success") return "true";
  return "false";
}

function main(): void {
  const { values } = parseArgs({
    options: {
      event: { type: "string" },
      "package-before": { type: "string" },
      "package-after": { type: "string" },
      "parent-conclusion": { type: "string" },
    },
  });
  const paths = readFileSync(0, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "");
  const before = values["package-before"];
  const after = values["package-after"];
  const packageJsonVersionOnly =
    before !== undefined &&
    after !== undefined &&
    onlyVersionChanged(readFileSync(before, "utf8"), readFileSync(after, "utf8"));
  const code = decideScope({
    docsOnly: isDocsOnly(paths, packageJsonVersionOnly),
    event: values.event ?? "",
    parentConclusion: values["parent-conclusion"] || null,
  });
  process.stdout.write(`code=${code}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
