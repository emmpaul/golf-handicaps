import type Database from "better-sqlite3";
import journal from "../../drizzle/meta/_journal.json";

/** Horodatage (`when`) de la dernière migration livrée avec ce code. */
export const EXPECTED_SCHEMA_VERSION = Math.max(...journal.entries.map((entry) => entry.when));

/**
 * Le web applique les migrations ; le worker attend qu'elles soient en base (design,
 * décision 2). drizzle enregistre le `when` de chaque migration dans `created_at`.
 */
export function isSchemaReady(sqlite: Database.Database, expected: number): boolean {
  const table = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'")
    .get();
  if (!table) return false;
  const latest = sqlite.prepare("SELECT max(created_at) FROM __drizzle_migrations").pluck().get();
  return Number(latest) >= expected;
}
