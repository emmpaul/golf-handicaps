import { join } from "node:path";
import { getEnv } from "@/lib/env";
import { type Db, openDatabase } from "./client";

/** Survit au rechargement à chaud de `next dev`, qui réévalue les modules. */
const holder = globalThis as { golfDatabase?: ReturnType<typeof openDatabase> };

/** Connexion du processus à `DATA_DIR/app.db`, ouverte au premier appel. */
export function getDb(): Db {
  holder.golfDatabase ??= openDatabase(join(getEnv().DATA_DIR, "app.db"));
  return holder.golfDatabase.db;
}
