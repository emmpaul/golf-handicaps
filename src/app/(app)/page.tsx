import { Camera } from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { PageTitle } from "@/components/page-title";
import { buttonVariants } from "@/components/ui/button";
import { formatPlayedOn, formatSignedTenths, formatTenths, NO_INDEX } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";
import { homeSummary } from "@/server/home/summary";

/** Colonnes du tableau des joueurs : nom, index posé en grand, écart au round précédent. */
const PLAYER_COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-baseline gap-x-3 px-2";

/**
 * Accueil : le tableau du groupe (spec `home-dashboard`). L'action d'import en tête, puis les
 * joueurs en rangées réglées, index en très grand, puis le dernier round en bloc réglé.
 */
export default async function Home() {
  const { players, latestRound, pendingImports } = homeSummary(await requestDb());
  return (
    <>
      <PageTitle>Handicaps golf</PageTitle>
      <Link href="/import" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-fit")}>
        <Camera aria-hidden data-icon="inline-start" /> Importer une carte
      </Link>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <section aria-labelledby="indexes-title" className="flex min-w-0 flex-col gap-2">
          <h2 id="indexes-title" className="font-heading text-xl font-extrabold">
            Index des joueurs
          </h2>
          <div>
            <div
              aria-hidden
              className={cn(PLAYER_COLUMNS, "bg-band py-1.5 text-sm font-medium text-band-ink")}
            >
              <span>Joueur</span>
              <span className="text-right">Index</span>
              <span className="text-right">Écart</span>
            </div>
            <ul>
              {players.map((player) => (
                <li key={player.id} className="border-b">
                  <Link
                    href={`/handicaps?joueur=${player.id}`}
                    className={cn(
                      PLAYER_COLUMNS,
                      "py-2 transition-[background-color] duration-(--dur-micro) ease-out hover:bg-muted focus-visible:-outline-offset-2",
                    )}
                  >
                    {/* Nom et index sur une même ligne de base (`items-baseline`) : le nom coupe
                        par `overflow: clip`, qui garde sa ligne de base, et non `hidden`, qui
                        la renvoie au bas de la boîte ; « provisoire » en ligne propre dessous. */}
                    <span className="flex min-w-0 flex-col">
                      <span className="overflow-x-clip font-heading text-2xl font-semibold text-ellipsis whitespace-nowrap">
                        {player.name}
                      </span>
                      {player.provisional ? (
                        <span className="text-sm text-muted-foreground">provisoire</span>
                      ) : null}
                    </span>
                    {player.indexT === null ? (
                      <span className="text-right text-sm text-muted-foreground">{NO_INDEX}</span>
                    ) : (
                      <span className="text-right font-heading text-[3.5rem] leading-none font-extrabold tabular-nums tracking-(--tracking-display)">
                        {formatTenths(player.indexT)}
                      </span>
                    )}
                    <span className="text-right text-muted-foreground tabular-nums">
                      {player.deltaT !== null ? formatSignedTenths(player.deltaT) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section aria-labelledby="latest-title" className="flex min-w-0 flex-col gap-2">
          <h2 id="latest-title" className="font-heading text-xl font-extrabold">
            Dernier round
          </h2>
          {latestRound ? (
            <Link
              href={`/rounds/${latestRound.id}`}
              className="flex flex-col gap-3 border-t-2 border-foreground px-2 pt-3 pb-3 transition-[background-color] duration-(--dur-micro) ease-out hover:bg-muted focus-visible:-outline-offset-2"
            >
              <span className="flex flex-col gap-1">
                <span className="font-heading text-2xl leading-tight font-extrabold [overflow-wrap:anywhere]">
                  {latestRound.courseName}
                </span>
                <span className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  <span>Tees {latestRound.tees}</span>
                  <time dateTime={latestRound.playedOn}>
                    {formatPlayedOn(latestRound.playedOn)}
                  </time>
                </span>
              </span>
              <ul className="flex flex-wrap gap-x-6 gap-y-1">
                {latestRound.players.map((player) => (
                  <li key={player.name} className="flex items-baseline gap-1.5">
                    <span>{player.name}</span>{" "}
                    <span className="font-heading text-2xl font-extrabold tabular-nums">
                      {player.gross}
                    </span>
                  </li>
                ))}
              </ul>
              {latestRound.netWinners.length > 0 ? (
                <p className="font-medium">
                  Gagnant net :{" "}
                  <span className="text-signal">{latestRound.netWinners.join(", ")}</span>
                </p>
              ) : null}
            </Link>
          ) : (
            <p className="border-t-2 border-foreground pt-3 text-muted-foreground">
              Aucun round enregistré
            </p>
          )}
        </section>
      </div>
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
