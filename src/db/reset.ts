import { rmSync } from "node:fs";
import { migrateDatabase, openDatabase } from "./client";
import { localSeeders, type Seeder } from "./seeders";

/** Supprime la base (et ses fichiers WAL), la recrée, la migre puis applique les seeders. */
export function resetDatabase(file: string, seeders: readonly Seeder[] = localSeeders) {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${file}${suffix}`, { force: true });
  }
  const { db, sqlite } = openDatabase(file);
  try {
    migrateDatabase(db);
    for (const seed of seeders) seed(db);
  } finally {
    sqlite.close();
  }
}
