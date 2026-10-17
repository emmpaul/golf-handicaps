import { desc } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports } from "@/db/schema";
import { importStatusLabel } from "@/jobs/imports";

const LISTED_IMPORTS = 20;

export type ImportListItem = ReturnType<typeof listImports>[number];

/** Derniers imports, du plus récent au plus ancien, avec leur état affiché. */
export function listImports(db: Db) {
  return db
    .select({
      id: imports.id,
      status: imports.status,
      roundId: imports.roundId,
      createdAt: imports.createdAt,
    })
    .from(imports)
    .orderBy(desc(imports.id))
    .limit(LISTED_IMPORTS)
    .all()
    .map((row) => ({
      id: row.id,
      status: row.status,
      label: importStatusLabel(row.status),
      roundId: row.roundId,
      createdAt: row.createdAt.toISOString(),
    }));
}
