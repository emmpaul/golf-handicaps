import type { Metadata } from "next";
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
import { formatIndex, formatPlayedOn, formatTenths } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
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

function PlayerHandicap({ player }: { player: PlayerOverview }) {
  const titleId = `player-${player.id}`;
  const newestFirst = [...player.history].reverse();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id={titleId} className="font-heading text-lg font-semibold">
          {player.name}
        </h2>
        <span data-testid="player-index" className="font-medium tabular-nums">
          Index {formatIndex(player.indexT, player.provisional)}
        </span>
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
          <Table aria-label={`Différentiels de ${player.name}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Différentiel</TableHead>
                <TableHead className="text-right">Index après</TableHead>
                <TableHead className="hidden md:table-cell">
                  <span className="sr-only">Retenu dans l'index actuel</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newestFirst.map((round) => (
                <TableRow key={round.roundId}>
                  {/* Sous `md`, la marque passe sous la date (courte) : la 4e colonne serait coupée,
                      et à côté de la date elle élargirait la 1re jusqu'à couper « Index après ». Les
                      deux dates sont rendues, l'une ou l'autre masquée en CSS. */}
                  <TableCell>
                    <span className="max-md:hidden">{formatPlayedOn(round.playedOn)}</span>
                    <span className="md:hidden">
                      {compactPlayedOn.format(new Date(`${round.playedOn}T00:00:00Z`))}
                    </span>
                    {round.countsInCurrent ? (
                      <span className="mt-1 block md:hidden">
                        <Badge>Compte</Badge>
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTenths(round.differentialT)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatTenths(round.indexAfterT)}
                  </TableCell>
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
export default async function HandicapsPage() {
  const players = playerOverviews(await requestDb());
  return (
    <>
      <PageTitle>Handicaps</PageTitle>
      <p className="text-sm text-muted-foreground">
        Index simulateur, inspiré du WHS : différentiel = score ajusté − par.
      </p>
      {players.map((player) => (
        <PlayerHandicap key={player.id} player={player} />
      ))}
    </>
  );
}
