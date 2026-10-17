import { join } from "node:path";

/** Fichier SQLite local : `$DATA_DIR/app.db` (`./data/app.db` par défaut). */
export const dbFile = join(process.env.DATA_DIR ?? "data", "app.db");
