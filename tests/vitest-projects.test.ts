import { globSync, readFileSync } from "node:fs";
import { matchesGlob, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import config from "../vitest.config.mjs";

const ROOT = resolve(import.meta.dirname, "..");

// Motifs écrits à la main : un fichier qui encode une image avec sharp, calcule scrypt ou lance
// le binaire OCR occupe un processeur plusieurs secondes et doit tourner dans le projet `heavy`, un
// fichier à la fois. On reconnaît l'import de sharp, l'appel à scrypt, la mention du binaire OCR, et
// l'import des modules qui font ce travail sans que le test le nomme : `@/lib/auth/login` (scrypt)
// et `@/ocr/read-scorecard` (OCR). Les classes de caractères évitent que ce fichier se reconnaisse
// lui-même.
const HEAVY_PATTERNS = [
  /from ["]shar[p]["]/,
  /scryp[t]Sync/,
  /tesserac[t]/i,
  /from ["]@\/lib\/auth\/logi[n]["]/,
  /from ["]@\/ocr\/read-scorecar[d]["]/,
];

type ProjectTest = { include?: string[]; exclude?: string[] };

// Sans `projects`, tous les fichiers tournent dans un seul projet en parallèle : c'est lui qui
// tient lieu de `unit`.
function unitProject(): ProjectTest {
  const projects = (config.test?.projects ?? []) as { test?: ProjectTest & { name?: string } }[];
  return projects.find((project) => project.test?.name === "unit")?.test ?? config.test ?? {};
}

function filesOf({ include = [], exclude = [] }: ProjectTest): string[] {
  return globSync(include, { cwd: ROOT })
    .filter((file) => !exclude.some((pattern) => matchesGlob(file, pattern)))
    .sort();
}

describe("projet Vitest unit", () => {
  // Mutation : retirer tests/jobs/imports.test.ts, tests/lib/auth/login.test.ts ou
  // tests/ocr/read-scorecard.test.ts de la liste `heavy` → il tombe dans `unit` et le test le nomme.
  it("ne contient aucun fichier qui lance sharp, scrypt ou le binaire OCR", () => {
    const offenders = filesOf(unitProject()).filter((file) => {
      const source = readFileSync(resolve(ROOT, file), "utf8");
      return HEAVY_PATTERNS.some((pattern) => pattern.test(source));
    });
    expect(offenders).toEqual([]);
  });

  // Garde-fou du test précédent : si les motifs `include` ne résolvent plus rien, la liste des
  // fautifs est vide pour une mauvaise raison. Mutation : `include: ["tests/*.test.ts"]` → rouge.
  it("résout les fichiers rapides", () => {
    expect(filesOf(unitProject())).toEqual(
      expect.arrayContaining([
        "tests/scripts/ci-scope.test.ts",
        "tests/components/round-editor/autosave.test.ts",
        "tests/vitest-projects.test.ts",
      ]),
    );
  });
});
