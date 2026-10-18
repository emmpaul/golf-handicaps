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
  /** JSON des lectures du job scope sur push (PR associée, exécution pr, arbres, ancêtre), ou null. */
  verifiedByPr: string | null;
};

/**
 * Vrai seulement si l'exécution pr du dernier commit de la PR a réussi, sur le même arbre que le
 * commit poussé, et que ce dernier commit contenait le commit précédent de main. Tout doute
 * (argument absent, JSON invalide, valeur manquante) rend faux.
 */
function isVerifiedByPr(verifiedByPr: string | null): boolean {
  if (verifiedByPr === null) return false;
  try {
    const reads = JSON.parse(verifiedByPr);
    return (
      reads?.runConclusion === "success" &&
      reads?.sameTree === true &&
      reads?.headContainsBefore === true
    );
  } catch {
    return false;
  }
}

export function decideScope({ docsOnly, event, verifiedByPr }: Scope): "true" | "false" {
  // Sur main, le classement documentation ne joue plus : seul l'arbre déjà vérifié par la PR compte.
  if (event === "push") return isVerifiedByPr(verifiedByPr) ? "false" : "true";
  return docsOnly ? "false" : "true";
}

function main(): void {
  const { values } = parseArgs({
    options: {
      event: { type: "string" },
      "package-before": { type: "string" },
      "package-after": { type: "string" },
      "verified-by-pr": { type: "string" },
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
    verifiedByPr: values["verified-by-pr"] || null,
  });
  process.stdout.write(`code=${code}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
