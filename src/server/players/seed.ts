import { count } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerAliases, players } from "@/db/schema";

const INITIAL_PLAYERS = ["Manu", "Gab", "Sean"];

/** Crée les joueurs du groupe, seulement sur une base sans aucun joueur (spec `players`). */
export function seedInitialPlayers(db: Db) {
  db.transaction((tx) => {
    const [{ total }] = tx.select({ total: count() }).from(players).all();
    if (total > 0) return;
    for (const name of INITIAL_PLAYERS) {
      const [{ id }] = tx.insert(players).values({ name }).returning({ id: players.id }).all();
      tx.insert(playerAliases).values({ playerId: id, alias: name.toUpperCase() }).run();
    }
  });
}
