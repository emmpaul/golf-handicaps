import type { Metadata } from "next";
import Link from "next/link";
import { IndexCurve } from "@/components/handicaps/index-curve";
import { PageTitle } from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPlayedOn, formatSignedTenths, formatTenths, NO_INDEX } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";
import { type PlayerOverview, playerOverviews } from "@/server/players/overview";

export const metadata: Metadata = { title: "Handicaps · Handicaps golf" };

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Date de jeu courte sous `md`, « 18 sept. 2026 », pour laisser la place à la marque « Compte ». */
const compactPlayedOn = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function PlayerHandicap({ player, selected }: { player: PlayerOverview; selected: boolean }) {
  const titleId = `player-${player.id}`;
  const previous = player.history.at(-2);
  const delta = player.indexT !== null && previous ? player.indexT - previous.indexAfterT : null;
  const newestFirst = [...player.history].reverse();
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border p-3",
        !selected && "max-md:hidden",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={titleId} className="font-heading text-lg font-semibold">
          {player.name}
        </h2>
        <div className="flex flex-wrap items-baseline gap-2 tabular-nums">
          <span data-testid="player-index" className="text-3xl font-semibold tracking-tight">
            {player.indexT === null ? (
              <span className="text-sm font-normal">{NO_INDEX}</span>
            ) : (
              formatTenths(player.indexT)
            )}
          </span>
          {delta !== null ? (
            <span data-testid="index-delta" className="text-sm text-muted-foreground">
              {formatSignedTenths(delta)}
            </span>
          ) : null}
          {player.provisional ? <Badge variant="secondary">provisoire</Badge> : null}
        </div>
      </div>
      {player.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun round pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          {/* Sur ordinateur, la courbe prend la hauteur de la table voisine. */}
          <IndexCurve
            name={player.name}
            points={player.history.map((round) => ({
              label: shortDate.format(new Date(`${round.playedOn}T00:00:00Z`)),
              index: round.indexAfterT / 10,
            }))}
          />
          <Table
            aria-label={`Différentiels de ${player.name}`}
            className="max-md:text-xs max-md:[&_td]:px-1 max-md:[&_th]:px-1 max-md:[&_th]:whitespace-normal"
          >
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">
                  {/* « Différentiel » ne se coupe pas : abrégé sous `md` pour tenir dans 320 px. */}
                  <span aria-hidden className="md:hidden">
                    Diff.
                  </span>
                  <span className="max-md:sr-only">Différentiel</span>
                </TableHead>
                <TableHead className="text-right">Index après</TableHead>
                <TableHead className="hidden md:table-cell">
                  <span className="sr-only">Retenu dans l'index actuel</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newestFirst.map((round) => (
                <TableRow key={round.roundId}>
                  <TableCell>
                    <span className="max-md:hidden">{formatPlayedOn(round.playedOn)}</span>
                    <span className="flex items-center gap-2 whitespace-nowrap md:hidden">
                      <span>{compactPlayedOn.format(new Date(`${round.playedOn}T00:00:00Z`))}</span>
                      {round.countsInCurrent ? <Badge>Compte</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatTenths(round.differentialT)}</TableCell>
                  <TableCell className="text-right">{formatTenths(round.indexAfterT)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {round.countsInCurrent ? <Badge>Compte</Badge> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/** Index simulateur de chaque joueur, sa courbe et ses différentiels (spec `handicap-index`). */
export default async function HandicapsPage({ searchParams }: PageProps<"/handicaps">) {
  const players = playerOverviews(await requestDb());
  const { joueur } = await searchParams;
  const selected = players.find((player) => String(player.id) === joueur)?.id ?? players[0]?.id;
  return (
    <>
      <PageTitle>Handicaps</PageTitle>
      <p className="text-sm text-muted-foreground">
        Index simulateur, inspiré du WHS : différentiel = score ajusté − par.
      </p>
      <nav
        aria-label="Choisir un joueur"
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 md:hidden"
      >
        {players.map((player) => (
          <Link
            key={player.id}
            href={`/handicaps?joueur=${player.id}`}
            aria-current={player.id === selected ? "page" : undefined}
            className="flex min-h-11 min-w-11 flex-1 items-center justify-center rounded-md px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {player.name}
          </Link>
        ))}
      </nav>
      {players.map((player) => (
        <PlayerHandicap key={player.id} player={player} selected={player.id === selected} />
      ))}
    </>
  );
}
