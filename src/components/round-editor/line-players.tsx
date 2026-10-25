"use client";

import { XIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Pending } from "@/components/ui/pending";
import type { EditorLine, PlayerOption } from "./form-state";

/** Valeur de l'option « Nouveau joueur… » du choix du joueur. */
const NEW_PLAYER = "new";

/** Crée un joueur ; renvoie le message de refus, ou `null` si la ligne lui est associée. */
export type CreatePlayer = (key: string, name: string) => Promise<string | null>;

function NewPlayerForm({
  number,
  onCreate,
}: {
  number: number;
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      setError(await onCreate(String(new FormData(event.currentTarget).get("name") ?? "")));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="col-span-2 flex min-w-0 flex-col gap-1"
    >
      <div className="flex gap-2">
        <Input
          name="name"
          aria-label={`Nom du nouveau joueur de la ligne ${number}`}
          placeholder="Nom du joueur"
          autoComplete="off"
          required
        />
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          aria-label={`Créer le joueur de la ligne ${number}`}
        >
          Créer
        </Button>
      </div>
      <Pending label={pending ? "Création du joueur…" : null} orb="save" />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function LinePlayer({
  line,
  position,
  players,
  invalid,
  onAssociate,
  onLeave,
  onRemove,
  onCreate,
}: {
  line: EditorLine;
  position: number;
  players: PlayerOption[];
  invalid: boolean;
  onAssociate: (key: string, playerId: number | null) => void;
  onLeave?: (cell: string) => void;
  onRemove: (key: string) => void;
  onCreate: CreatePlayer;
}) {
  const [creating, setCreating] = useState(false);
  const number = position + 1;

  async function create(name: string) {
    const error = await onCreate(line.key, name);
    if (error === null) setCreating(false);
    return error;
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <div className="col-span-2 flex flex-wrap items-baseline gap-x-2">
        <span className="w-16 text-sm font-medium">Ligne {number}</span>
        {line.name ? (
          <span className="text-sm text-muted-foreground">lu « {line.name} »</span>
        ) : null}
      </div>
      <NativeSelect
        className="min-w-0 w-full"
        aria-label={`Joueur de la ligne ${number}`}
        aria-invalid={invalid || undefined}
        onBlur={() => onLeave?.(`player${position}:player`)}
        value={creating ? NEW_PLAYER : (line.playerId ?? "")}
        onChange={(event) => {
          const { value } = event.currentTarget;
          setCreating(value === NEW_PLAYER);
          if (value !== NEW_PLAYER) onAssociate(line.key, value ? Number(value) : null);
        }}
      >
        <NativeSelectOption value="">Choisir un joueur</NativeSelectOption>
        {players.map((player) => (
          <NativeSelectOption key={player.id} value={player.id}>
            {player.name}
          </NativeSelectOption>
        ))}
        <NativeSelectOption value={NEW_PLAYER}>Nouveau joueur…</NativeSelectOption>
      </NativeSelect>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Retirer la ligne ${number}`}
        onClick={() => onRemove(line.key)}
      >
        <XIcon />
      </Button>
      {creating ? <NewPlayerForm number={number} onCreate={create} /> : null}
    </div>
  );
}

/** Association joueur de chaque ligne de la carte, création d'un joueur, ajout et retrait de lignes. */
export function LinePlayers({
  lines,
  players,
  invalid,
  canAdd,
  onAssociate,
  onLeave,
  onCreate,
  onRemove,
  onAdd,
}: {
  lines: EditorLine[];
  players: PlayerOption[];
  invalid: ReadonlySet<string>;
  canAdd: boolean;
  onAssociate: (key: string, playerId: number | null) => void;
  onLeave?: (cell: string) => void;
  onCreate: CreatePlayer;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, position) => (
        <LinePlayer
          key={line.key}
          line={line}
          position={position}
          players={players}
          invalid={invalid.has(`player${position}:player`)}
          onAssociate={onAssociate}
          onLeave={onLeave}
          onRemove={onRemove}
          onCreate={onCreate}
        />
      ))}
      <Button variant="outline" className="self-start" disabled={!canAdd} onClick={onAdd}>
        Ajouter une ligne
      </Button>
    </div>
  );
}
