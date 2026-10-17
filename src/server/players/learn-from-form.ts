import type { Db } from "@/db/client";
import type { RoundForm } from "@/scorecard/checks";
import { findPlayerForName, learnAlias } from "./aliases";

/**
 * Après l'enregistrement d'un round importé : chaque nom lu qui ne désignait pas déjà
 * exactement le joueur choisi devient un alias de ce joueur (spec `players`).
 */
export function learnAliasesFromForm(db: Db, form: RoundForm) {
  for (const { name, playerId } of form.players) {
    if (!name?.trim() || playerId === null) continue;
    const match = findPlayerForName(db, name);
    if (match?.match !== "exact" || match.playerId !== playerId) learnAlias(db, playerId, name);
  }
}
