import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports } from "@/db/schema";
import type { RoundForm } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import { findPlayerForName } from "@/server/players/aliases";

export function getImport(db: Db, id: number) {
  return db.select().from(imports).where(eq(imports.id, id)).get();
}

/**
 * Brouillon lu, chaque ligne associée au joueur dont le nom ou un alias correspond
 * (spec `players`) ; sans correspondance, la ligne attend le choix de l'utilisateur.
 */
export function formFromDraft(db: Db, draft: ScorecardDraft): RoundForm {
  return {
    ...draft,
    players: draft.players.map((row) => ({
      ...row,
      playerId: row.name ? (findPlayerForName(db, row.name)?.playerId ?? null) : null,
    })),
  };
}
