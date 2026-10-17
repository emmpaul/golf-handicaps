import { connection } from "next/server";
import type { Db } from "@/db/client";
import { getDb } from "@/db/instance";

/**
 * Base lue au moment de la requête : better-sqlite3 est synchrone, donc sans
 * `connection()` Next figerait le résultat au build (doc Next, `connection`).
 */
export async function requestDb(): Promise<Db> {
  await connection();
  return getDb();
}
