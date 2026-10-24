import type { Db } from "@/db/client";
import { listImports } from "@/server/imports/list";
import { playerOverviews } from "@/server/players/overview";
import { listRounds } from "@/server/rounds/list";

/** Résumé de l'accueil à partir des lectures partagées. */
export function homeSummary(db: Db) {
  const players = playerOverviews(db).map(({ id, name, indexT, provisional, history }) => {
    const previous = history.at(-2);
    return {
      id,
      name,
      indexT,
      provisional,
      deltaT: indexT !== null && previous ? indexT - previous.indexAfterT : null,
    };
  });
  const pending = listImports(db, -1).filter(
    (item) => item.status === "ready" && item.roundId === null,
  );
  return {
    players,
    latestRound: listRounds(db)[0] ?? null,
    pendingImports: { count: pending.length, latestId: pending[0]?.id ?? null },
  };
}
