import { count } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerAliases, players } from "@/db/schema";

/** Joueurs de `pnpm db:reset`, des tests et des e2e ; la prod lit `INITIAL_PLAYERS`. */
export const DEV_PLAYERS: readonly string[] = ["Manu", "Gab", "Sean"];

/** Crée les joueurs `names`, seulement sur une base sans aucun joueur (spec `players`). */
export function seedInitialPlayers(db: Db, names: readonly string[]) {
  db.transaction((tx) => {
    const [{ total }] = tx.select({ total: count() }).from(players).all();
    if (total > 0) return;
    for (const name of names) {
      const [{ id }] = tx.insert(players).values({ name }).returning({ id: players.id }).all();
      tx.insert(playerAliases).values({ playerId: id, alias: name.toUpperCase() }).run();
    }
  });
}
