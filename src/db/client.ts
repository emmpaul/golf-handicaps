import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export function openDatabase(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  // Web et worker écrivent dans le même fichier (design, décision 2).
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle({ client: sqlite, schema });
  return { db, sqlite };
}

export type Db = ReturnType<typeof openDatabase>["db"];

export function migrateDatabase(db: Db, migrationsFolder = join(process.cwd(), "drizzle")) {
  migrate(db, { migrationsFolder });
}
