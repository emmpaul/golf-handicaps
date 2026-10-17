import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { EXPECTED_SCHEMA_VERSION, isSchemaReady } from "@/jobs/schema-version";
import { createTestDb } from "../factories";

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function migratedDb() {
  const testDb = createTestDb();
  cleanups.push(testDb.cleanup);
  return testDb.sqlite;
}

describe("isSchemaReady", () => {
  it("attend tant que la base n'a reçu aucune migration", () => {
    const dir = mkdtempSync(join(tmpdir(), "golf-empty-"));
    const { sqlite } = openDatabase(join(dir, "app.db"));
    cleanups.push(() => {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    });
    expect(isSchemaReady(sqlite, EXPECTED_SCHEMA_VERSION)).toBe(false);
  });

  it("attend tant que la table des migrations est encore vide", () => {
    const sqlite = migratedDb();
    sqlite.exec("DELETE FROM __drizzle_migrations");
    expect(isSchemaReady(sqlite, EXPECTED_SCHEMA_VERSION)).toBe(false);
  });

  it("est prêt quand toutes les migrations livrées sont appliquées", () => {
    expect(isSchemaReady(migratedDb(), EXPECTED_SCHEMA_VERSION)).toBe(true);
  });

  it("attend une migration plus récente que la dernière appliquée", () => {
    expect(isSchemaReady(migratedDb(), 9_999_999_999_999)).toBe(false);
  });

  it("accepte la première migration du projet (0000_init, 1792251843742)", () => {
    expect(isSchemaReady(migratedDb(), 1_792_251_843_742)).toBe(true);
  });
});
