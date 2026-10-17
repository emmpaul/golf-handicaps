import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { formatPlayedOn, NO_VALUE } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { listRounds } from "@/server/rounds/list";

export const metadata: Metadata = { title: "Rounds · Handicaps golf" };

/** Rounds du plus récent au plus ancien, bruts et gagnant net (spec `rounds`). */
export default async function RoundsPage() {
  const rounds = listRounds(await requestDb());
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageTitle>Rounds</PageTitle>
        <Link href="/rounds/new" className="text-sm underline underline-offset-3">
          Saisie manuelle
        </Link>
      </div>
      {rounds.length === 0 ? (
        <p className="text-muted-foreground">Aucun round enregistré.</p>
      ) : null}
      <ul aria-label="Rounds" className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {rounds.map((round) => (
          <li key={round.id} className="flex rounded-lg border hover:bg-muted/50">
            <Link href={`/rounds/${round.id}`} className="flex flex-1 flex-col gap-1 p-3">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">
                  {round.courseName} · {round.tees}
                </span>
                <time dateTime={round.playedOn} className="text-sm text-muted-foreground">
                  {formatPlayedOn(round.playedOn)}
                </time>
              </span>
              <span className="flex flex-wrap gap-x-3 text-sm">
                {round.players.map(({ name, gross }) => (
                  <span key={name} data-testid="round-gross">
                    {name} {gross}
                  </span>
                ))}
              </span>
              <span data-testid="round-winner" className="text-sm text-muted-foreground">
                Gagnant net : {round.netWinners.length > 0 ? round.netWinners.join(", ") : NO_VALUE}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
