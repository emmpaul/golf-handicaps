import { seedInitialPlayers } from "@/server/players/seed";
import { type Db, migrateDatabase } from "./client";

/**
 * Démarrage du web (design, décision 2) : applique les migrations, puis crée les joueurs
 * `initialPlayers` sur une base sans joueur (spec `players`). Le web passe `INITIAL_PLAYERS`,
 * `pnpm db:reset` et les tests `DEV_PLAYERS` (harden-self-hosting, décision 1). Liste vide :
 * aucun joueur. Sans effet sur une base déjà prête.
 */
export function prepareDatabase(db: Db, initialPlayers: readonly string[]) {
  migrateDatabase(db);
  seedInitialPlayers(db, initialPlayers);
}
