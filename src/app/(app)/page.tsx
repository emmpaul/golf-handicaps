import { Camera } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPlayedOn, formatSignedTenths, formatTenths, NO_INDEX } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";
import { homeSummary } from "@/server/home/summary";

export default async function Home() {
  const { players, latestRound, pendingImports } = homeSummary(await requestDb());
  return (
    <>
      <PageTitle>Handicaps golf</PageTitle>
      <Link href="/import" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}>
        <Camera aria-hidden data-icon="inline-start" /> Importer une carte
      </Link>
      <section aria-labelledby="indexes-title" className="flex flex-col gap-3">
        <h2 id="indexes-title" className="font-heading text-lg font-semibold">
          Index des joueurs
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {players.map((player) => (
            <li key={player.id}>
              <Link
                href={`/handicaps?joueur=${player.id}`}
                className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Card>
                  <CardHeader>
                    <CardTitle>{player.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-baseline gap-2 tabular-nums">
                    {player.indexT === null ? (
                      <span className="text-sm text-muted-foreground">{NO_INDEX}</span>
                    ) : (
                      <span className="text-3xl font-semibold tracking-tight">
                        {formatTenths(player.indexT)}
                      </span>
                    )}
                    {player.deltaT !== null ? (
                      <span className="text-sm text-muted-foreground">
                        {formatSignedTenths(player.deltaT)}
                      </span>
                    ) : null}
                    {player.provisional ? <Badge variant="secondary">provisoire</Badge> : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="latest-title" className="flex flex-col gap-3">
        <h2 id="latest-title" className="font-heading text-lg font-semibold">
          Dernier round
        </h2>
        {latestRound ? (
          <Link
            href={`/rounds/${latestRound.id}`}
            className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Card>
              <CardHeader>
                <CardTitle>
                  {latestRound.courseName} · {latestRound.tees}
                </CardTitle>
                <time dateTime={latestRound.playedOn} className="text-sm text-muted-foreground">
                  {formatPlayedOn(latestRound.playedOn)}
                </time>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <ul className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
                  {latestRound.players.map((player) => (
                    <li key={player.name}>
                      {player.name} {player.gross}
                    </li>
                  ))}
                </ul>
                {latestRound.netWinners.length > 0 ? (
                  <p className="text-sm font-medium text-primary">
                    Gagnant net : {latestRound.netWinners.join(", ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun round enregistré</p>
        )}
      </section>
      {pendingImports.count > 0 ? (
        <Link
          href={`/imports/${pendingImports.latestId}`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-fit")}
        >
          {pendingImports.count} {pendingImports.count === 1 ? "import" : "imports"} à vérifier
        </Link>
      ) : null}
      <LogoutButton />
    </>
  );
}
