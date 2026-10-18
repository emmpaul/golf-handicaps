import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { playerAliases, players } from "@/db/schema";
import { matchPlayerName, normalizePlayerName, type PlayerMatch } from "@/domain/player-match";

function loadCandidates(db: Db) {
  const rows = db
    .select({ id: players.id, name: players.name, alias: playerAliases.alias })
    .from(players)
    .leftJoin(playerAliases, eq(playerAliases.playerId, players.id))
    .orderBy(players.id)
    .all();
  const byId = new Map<number, { id: number; name: string; aliases: string[] }>();
  for (const { id, name, alias } of rows) {
    const candidate = byId.get(id) ?? { id, name, aliases: [] };
    if (alias !== null) candidate.aliases.push(alias);
    byId.set(id, candidate);
  }
  return [...byId.values()];
}

/** Joueur correspondant à un nom lu sur une carte (spec `players`), ou `null`. */
export function findPlayerForName(db: Db, read: string): PlayerMatch | null {
  return matchPlayerName(read, loadCandidates(db));
}

/** Mémorise le nom lu comme alias du joueur choisi à la main, pour les imports suivants. */
export function learnAlias(db: Db, playerId: number, read: string) {
  const alias = normalizePlayerName(read);
  db.transaction((tx) => {
    tx.delete(playerAliases).where(sql`lower(${playerAliases.alias}) = lower(${alias})`).run();
    tx.insert(playerAliases).values({ playerId, alias }).run();
  });
}

/** Retire un alias du joueur (spec `players`, « Retrait d'un alias ») ; un alias absent ne fait rien. */
export function removeAlias(db: Db, playerId: number, alias: string) {
  db.delete(playerAliases)
    .where(
      and(
        eq(playerAliases.playerId, playerId),
        sql`lower(${playerAliases.alias}) = lower(${normalizePlayerName(alias)})`,
      ),
    )
    .run();
}
