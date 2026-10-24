import { desc } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports } from "@/db/schema";
import { importStatusLabel } from "@/jobs/imports";

const LISTED_IMPORTS = 20;

export type ImportListItem = ReturnType<typeof listImports>[number];

/**
 * Derniers imports, du plus récent au plus ancien, avec leur état affiché. `panelNotFound` :
 * import en « Échec » sans coins, aucun cadrage trouvé sur la photo (design, décision 5).
 * `limit: -1` lit tous les imports pour compter ceux qui attendent une vérification.
 */
export function listImports(db: Db, limit = LISTED_IMPORTS) {
  return db
    .select({
      id: imports.id,
      status: imports.status,
      roundId: imports.roundId,
      corners: imports.corners,
      createdAt: imports.createdAt,
    })
    .from(imports)
    .orderBy(desc(imports.id))
    .limit(limit)
    .all()
    .map((row) => ({
      id: row.id,
      status: row.status,
      label: importStatusLabel(row.status),
      roundId: row.roundId,
      panelNotFound: row.status === "failed" && row.corners === null,
      createdAt: row.createdAt.toISOString(),
    }));
}
