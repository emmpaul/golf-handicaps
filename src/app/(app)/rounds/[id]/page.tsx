import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { DeleteRound } from "@/components/rounds/delete-round";
import { NetLeaderboard } from "@/components/rounds/net-leaderboard";
import { buttonVariants } from "@/components/ui/button";
import { formatPlayedOn } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";
import { roundDetail } from "@/server/rounds/detail";

export const metadata: Metadata = { title: "Round · Handicaps golf" };

export default async function RoundPage({ params }: PageProps<"/rounds/[id]">) {
  const { id } = await params;
  const round = /^\d+$/.test(id) ? roundDetail(await requestDb(), Number(id)) : undefined;
  if (!round) notFound();
  return (
    <>
      <div className="flex flex-col gap-1">
        <PageTitle>{round.courseName}</PageTitle>
        <p data-testid="round-summary" className="text-muted-foreground">
          Tees {round.tees} · {formatPlayedOn(round.playedOn)} · Par {round.par}
        </p>
      </div>
      <div
        className={cn("grid grid-cols-1 gap-4 lg:items-start", round.photoPath && "lg:grid-cols-2")}
      >
        <div className="flex flex-col gap-4">
          <NetLeaderboard entries={round.leaderboard} />
          <div className="flex flex-wrap gap-2">
            <Link href={`/rounds/${round.id}/edit`} className={buttonVariants({ size: "lg" })}>
              Modifier
            </Link>
            <DeleteRound roundId={round.id} />
          </div>
        </div>
        {round.photoPath ? (
          <a href={`/api/rounds/${round.id}/photo`} target="_blank" rel="noreferrer">
            {/* biome-ignore lint/performance/noImgElement: servie par une route authentifiée. */}
            <img
              src={`/api/rounds/${round.id}/photo`}
              alt="Carte du round"
              className="w-full rounded-lg border"
            />
          </a>
        ) : null}
      </div>
    </>
  );
}
