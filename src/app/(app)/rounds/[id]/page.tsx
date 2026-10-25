import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { DeleteRound } from "@/components/rounds/delete-round";
import { NetLeaderboard } from "@/components/rounds/net-leaderboard";
import { RoundScorecard } from "@/components/rounds/round-scorecard";
import { buttonVariants } from "@/components/ui/button";
import { formatPlayedOn, formatTenths } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { ACTION_LINK, cn } from "@/lib/utils";
import { roundDetail } from "@/server/rounds/detail";
import { getRoundForm } from "@/server/rounds/edit";

export const metadata: Metadata = { title: "Round · Handicaps golf" };

export default async function RoundPage({ params }: PageProps<"/rounds/[id]">) {
  const { id } = await params;
  const db = await requestDb();
  const round = /^\d+$/.test(id) ? roundDetail(db, Number(id)) : undefined;
  if (!round) notFound();
  return (
    <>
      <div className="flex flex-col gap-2">
        <PageTitle>{round.courseName}</PageTitle>
        {/* Tees, date et par en trois éléments, sans points médians (spec `rounds`, « En-tête d'un round »). */}
        <p
          data-testid="round-summary"
          className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground"
        >
          <span>Tees {round.tees}</span>
          <time dateTime={round.playedOn}>{formatPlayedOn(round.playedOn)}</time>
          <span>Par {round.par}</span>
        </p>
        {/* Rating des différentiels et du classement net, lien vers la page Parcours (spec `rounds`) ;
            rating et slope en deux éléments, sans point médian (DESIGN.md, règles d'écran). */}
        <Link
          href="/courses"
          data-testid="round-rating"
          className={cn(ACTION_LINK, "w-fit gap-x-4 text-sm tabular-nums")}
        >
          {round.rating.rated ? (
            <>
              <span>Rating {formatTenths(round.rating.ratingT)}</span>
              <span>Slope {round.rating.slope}</span>
            </>
          ) : (
            `Sans rating (par ${round.par}, slope 113)`
          )}
        </Link>
      </div>
      {/* Une colonne sous 1 024 px : classement, carte de score, photo, actions. À partir de
          1 024 px, la photo se pose à côté du classement et la carte prend toute la largeur. */}
      <div
        className={cn(
          "grid grid-cols-1 gap-6 lg:items-start",
          round.photoPath && "lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]",
        )}
      >
        {/* Largeur bornée : à 1 440 px, cinq colonnes étirées sur 1 248 px se lisent mal. */}
        <section
          aria-labelledby="leaderboard-title"
          className="flex max-w-2xl min-w-0 flex-col gap-2"
        >
          <h2 id="leaderboard-title" className="font-heading text-xl font-extrabold">
            Classement net
          </h2>
          <NetLeaderboard entries={round.leaderboard} />
        </section>
        {round.photoPath ? (
          <a
            href={`/api/rounds/${round.id}/photo`}
            target="_blank"
            rel="noreferrer"
            className="block max-lg:order-1"
          >
            {/* biome-ignore lint/performance/noImgElement: servie par une route authentifiée. */}
            <img
              src={`/api/rounds/${round.id}/photo`}
              alt="Carte du round"
              className="w-full border object-contain lg:max-h-96"
            />
          </a>
        ) : null}
        <div className="min-w-0 lg:col-span-full">
          <RoundScorecard round={getRoundForm(db, round.id)} />
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4 max-lg:order-2 lg:col-span-full">
          <Link href={`/rounds/${round.id}/edit`} className={buttonVariants({ size: "lg" })}>
            Modifier
          </Link>
          <DeleteRound roundId={round.id} />
        </div>
      </div>
    </>
  );
}
