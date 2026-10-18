import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Fichiers qui encodent des images avec sharp, calculent scrypt ou lancent Tesseract : chacun
// occupe un processeur plusieurs secondes. En parallèle, ils se disputent les 4 vCPU du runner CI
// et dépassent leurs délais ; ils tournent donc après les autres, un fichier à la fois.
// `tests/vitest-projects.test.ts` échoue si un fichier lourd n'est pas listé ici.
const HEAVY = [
  "tests/app/api/imports.test.ts",
  "tests/ocr/read-scorecard.test.ts",
  "tests/ocr/tesseract-reader.test.ts",
  "tests/ocr/detect-panel.test.ts",
  "tests/ai/completer.test.ts",
  "tests/ai/corner-locator.test.ts",
  "tests/lib/auth/login.test.ts",
  "tests/jobs/ocr-scorecard.test.ts",
  "tests/jobs/convert-photos.test.ts",
  "tests/jobs/locate-panel.test.ts",
  "tests/jobs/imports.test.ts",
];

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
          exclude: ["tests/e2e/**", "node_modules/**", ...HEAVY],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "heavy",
          include: HEAVY,
          maxWorkers: 1,
          testTimeout: 60_000,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
