import { seedInitialPlayers } from "@/server/players/seed";
import { type Db, migrateDatabase } from "./client";

/**
 * Démarrage du web (design, décision 2) : applique les migrations, puis crée les joueurs
 * initiaux sur une base sans joueur (spec `players`). Sans effet sur une base déjà prête.
 */
export function prepareDatabase(db: Db) {
  migrateDatabase(db);
  seedInitialPlayers(db);
}
