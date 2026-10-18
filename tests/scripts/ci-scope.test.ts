import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decideScope, isDocsOnly, onlyVersionChanged } from "../../scripts/ci-scope";

describe("onlyVersionChanged", () => {
  it("rend true quand seule la version change", () => {
    expect(
      onlyVersionChanged(
        '{"name": "golf-handicaps", "version": "0.2.0", "dependencies": {"zod": "4.1.0"}}',
        '{"name": "golf-handicaps", "version": "0.3.0", "dependencies": {"zod": "4.1.0"}}',
      ),
    ).toBe(true);
  });

  it("rend false quand une dépendance change avec la version", () => {
    expect(
      onlyVersionChanged(
        '{"name": "golf-handicaps", "version": "0.2.0", "dependencies": {"zod": "4.1.0"}}',
        '{"name": "golf-handicaps", "version": "0.3.0", "dependencies": {"zod": "4.2.0"}}',
      ),
    ).toBe(false);
  });

  it("rend false quand seul scripts.test change", () => {
    expect(
      onlyVersionChanged(
        '{"version": "0.2.0", "scripts": {"test": "vitest run"}}',
        '{"version": "0.2.0", "scripts": {"test": "vitest"}}',
      ),
    ).toBe(false);
  });

  it("rend false quand devDependencies gagne une clé", () => {
    expect(
      onlyVersionChanged(
        '{"version": "0.2.0", "devDependencies": {"vitest": "5.0.5"}}',
        '{"version": "0.2.0", "devDependencies": {"vitest": "5.0.5", "tsx": "4.21.0"}}',
      ),
    ).toBe(false);
  });

  it("rend false quand packageManager change", () => {
    expect(
      onlyVersionChanged(
        '{"version": "0.2.0", "packageManager": "pnpm@12.14.0"}',
        '{"version": "0.2.0", "packageManager": "pnpm@12.15.0"}',
      ),
    ).toBe(false);
  });

  it("rend true pour les mêmes clés dans un autre ordre", () => {
    expect(
      onlyVersionChanged(
        '{"name": "golf-handicaps", "version": "0.2.0", "dependencies": {"next": "16.4.2", "zod": "4.1.0"}}',
        '{"dependencies": {"zod": "4.1.0", "next": "16.4.2"}, "version": "0.2.0", "name": "golf-handicaps"}',
      ),
    ).toBe(true);
  });

  it("rend false quand after n'est pas du JSON", () => {
    expect(onlyVersionChanged('{"version": "0.2.0"}', "<<<<<<< HEAD")).toBe(false);
  });
});

describe("isDocsOnly", () => {
  it.each([
    [["openspec/changes/x/tasks.md", "openspec/changes/x/design.md"]],
    [["README.md", "CLAUDE.md"]],
    [["docs/deploy.md", ".github/pull_request_template.md"]],
    [["openspec/config.yaml"]],
    [["docs/diagram.png"]],
  ])("classe %j comme documentation", (paths) => {
    expect(isDocsOnly(paths, false)).toBe(true);
  });

  it("classe la PR de release comme documentation quand seule la version de package.json change", () => {
    expect(
      isDocsOnly(["CHANGELOG.md", ".release-please-manifest.json", "package.json"], true),
    ).toBe(true);
  });

  it("ne classe pas la même liste comme documentation quand package.json change ailleurs", () => {
    expect(
      isDocsOnly(["CHANGELOG.md", ".release-please-manifest.json", "package.json"], false),
    ).toBe(false);
  });

  it.each([
    [["openspec/changes/x/tasks.md", "src/lib/env.ts"]],
    [["openspec-tools/x.ts"]],
    [[".github/workflows/checks.yml"]],
    [["pnpm-lock.yaml"]],
    [[]],
  ])("ne classe pas %j comme documentation", (paths) => {
    expect(isDocsOnly(paths, true)).toBe(false);
  });
});

const HEAD_SHA = "5acf90a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7";

function verified(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    pr: 28,
    headSha: HEAD_SHA,
    runConclusion: "success",
    sameTree: true,
    headContainsBefore: true,
    ...overrides,
  });
}

describe("decideScope", () => {
  it.each([
    [{ docsOnly: true, event: "pull_request", verifiedByPr: null }, "false"],
    [{ docsOnly: false, event: "pull_request", verifiedByPr: null }, "true"],
  ])("pour une PR %j, rend %j", (scope, code) => {
    expect(decideScope(scope)).toBe(code);
  });

  it("rend false sur push quand la PR a réussi sur le même arbre et contenait le commit précédent", () => {
    expect(decideScope({ docsOnly: false, event: "push", verifiedByPr: verified() })).toBe("false");
  });

  it.each([
    ['runConclusion "failure"', verified({ runConclusion: "failure" })],
    ['runConclusion "cancelled"', verified({ runConclusion: "cancelled" })],
    ['runConclusion ""', verified({ runConclusion: "" })],
    ["sameTree false", verified({ sameTree: false })],
    ["headContainsBefore false", verified({ headContainsBefore: false })],
    ["argument absent", null],
    ["JSON invalide", '{"pr": 28, "runConclusion": "success"'],
  ])("rend true sur push avec %s", (_label, verifiedByPr) => {
    expect(decideScope({ docsOnly: false, event: "push", verifiedByPr })).toBe("true");
  });

  it("rend true sur push pour de la documentation seule non vérifiée par une PR", () => {
    expect(decideScope({ docsOnly: true, event: "push", verifiedByPr: null })).toBe("true");
  });
});

const SCRIPT = resolve("scripts/ci-scope.ts");

function runScope(input: string, args: string[], script = SCRIPT, cwd = process.cwd()): string {
  return execFileSync(process.execPath, [script, ...args], { input, cwd, encoding: "utf8" });
}

describe("ci-scope.ts en ligne de commande", () => {
  it("écrit code=true quand un fichier de code accompagne la documentation", () => {
    expect(runScope("openspec/a.md\nsrc/b.ts\n", ["--event", "pull_request"])).toBe("code=true\n");
  });

  it("écrit code=false pour une PR de documentation seule", () => {
    expect(runScope("openspec/a.md\n", ["--event", "pull_request"])).toBe("code=false\n");
  });

  it("écrit code=false quand package.json ne diffère que par sa version", () => {
    const dir = mkdtempSync(join(tmpdir(), "ci-scope-"));
    const before = join(dir, "before.json");
    const after = join(dir, "after.json");
    writeFileSync(before, '{"name": "golf-handicaps", "version": "0.2.0", "private": true}');
    writeFileSync(after, '{"name": "golf-handicaps", "version": "0.3.0", "private": true}');
    expect(
      runScope("CHANGELOG.md\npackage.json\n", [
        "--event",
        "pull_request",
        "--package-before",
        before,
        "--package-after",
        after,
      ]),
    ).toBe("code=false\n");
  });

  it("écrit code=false sur push pour src/lib/env.ts vérifié par sa PR", () => {
    expect(runScope("src/lib/env.ts\n", ["--event", "push", "--verified-by-pr", verified()])).toBe(
      "code=false\n",
    );
  });

  it("écrit code=true sur push pour openspec/x.md non vérifié par une PR", () => {
    expect(runScope("openspec/x.md\n", ["--event", "push"])).toBe("code=true\n");
  });

  it("écrit code=true pour une entrée vide", () => {
    expect(runScope("", ["--event", "pull_request"])).toBe("code=true\n");
  });

  it("tourne dans un dossier sans node_modules", () => {
    // Chemin réel : sur macOS, /var est un lien vers /private/var, et la garde de main compare
    // import.meta.url (résolu) à process.argv[1] (non résolu).
    const dir = mkdtempSync(join(realpathSync(tmpdir()), "ci-scope-"));
    const script = join(dir, "ci-scope.ts");
    copyFileSync(SCRIPT, script);
    expect(runScope("openspec/a.md\n", ["--event", "pull_request"], script, dir)).toBe(
      "code=false\n",
    );
  });
});
