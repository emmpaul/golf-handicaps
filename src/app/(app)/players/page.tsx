import type { Metadata } from "next";
import { PageTitle } from "@/components/page-title";
import { InlineForm } from "@/components/players/inline-form";
import { formatIndex, NO_VALUE } from "@/lib/format";
import { requestDb } from "@/lib/request-db";
import { playerOverviews } from "@/server/players/overview";
import { addAliasAction, addPlayerAction, renamePlayerAction } from "./actions";

export const metadata: Metadata = { title: "Joueurs · Handicaps golf" };

/** Joueurs du groupe : ajout, renommage et alias reconnus sur les cartes (spec `players`). */
export default async function PlayersPage() {
  const players = playerOverviews(await requestDb());
  return (
    <>
      <PageTitle>Joueurs</PageTitle>
      {/* « Ajouter un joueur » en tête, sur téléphone comme sur ordinateur. */}
      <div className="flex flex-col gap-4">
        <section
          aria-labelledby="add-player-title"
          className="flex flex-col gap-2 lg:w-80 lg:rounded-lg lg:border lg:p-3"
        >
          <h2 id="add-player-title" className="font-heading font-semibold">
            Ajouter un joueur
          </h2>
          <InlineForm
            action={addPlayerAction}
            field="name"
            label="Nouveau joueur"
            submit="Ajouter"
          />
        </section>
        <ul
          aria-label="Joueurs"
          className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
        >
          {players.map((player) => (
            <li key={player.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="font-heading text-lg font-semibold">{player.name}</h2>
                <span data-testid="player-index" className="text-sm text-muted-foreground">
                  Index {formatIndex(player.indexT, player.provisional)}
                </span>
              </div>
              <p data-testid="player-aliases" className="text-sm">
                Alias : {player.aliases.length > 0 ? player.aliases.join(", ") : NO_VALUE}
              </p>
              <InlineForm
                key={`name-${player.name}`}
                action={renamePlayerAction}
                field="name"
                label={`Nom de ${player.name}`}
                submit="Renommer"
                playerId={player.id}
                defaultValue={player.name}
              />
              <InlineForm
                action={addAliasAction}
                field="alias"
                label={`Nouvel alias de ${player.name}`}
                submit="Ajouter l'alias"
                playerId={player.id}
              />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
