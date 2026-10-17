import { SqliteError } from "better-sqlite3";
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players } from "@/db/schema";

export function listPlayers(db: Db) {
  return db
    .select({ id: players.id, name: players.name })
    .from(players)
    .orderBy(asc(sql`lower(${players.name})`))
    .all();
}

export class DuplicatePlayerError extends Error {
  constructor() {
    super("Ce joueur existe déjà");
    this.name = "DuplicatePlayerError";
  }
}

/** L'index unique `lower(name)` refuse un nom déjà pris, sans tenir compte de la casse. */
function refuseDuplicateName<T>(write: () => T): T {
  try {
    return write();
  } catch (error) {
    if (error instanceof SqliteError && error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new DuplicatePlayerError();
    }
    throw error;
  }
}

export function addPlayer(db: Db, name: string) {
  return refuseDuplicateName(() =>
    db.insert(players).values({ name }).returning({ id: players.id, name: players.name }).get(),
  );
}

export function renamePlayer(db: Db, id: number, name: string) {
  refuseDuplicateName(() => db.update(players).set({ name }).where(eq(players.id, id)).run());
}
