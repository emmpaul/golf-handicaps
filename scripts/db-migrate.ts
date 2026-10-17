import { migrateDatabase, openDatabase } from "../src/db/client";
import { dbFile } from "./db-file";

const { db, sqlite } = openDatabase(dbFile);
try {
  migrateDatabase(db);
  console.info(`Migrations appliquées sur ${dbFile}`);
} finally {
  sqlite.close();
}
