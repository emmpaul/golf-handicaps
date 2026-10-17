"use client";

import { useActionState } from "react";
import type { PlayerFormState } from "@/app/(app)/players/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Action = (previous: PlayerFormState, formData: FormData) => Promise<PlayerFormState>;

const initialState: PlayerFormState = { error: null, done: 0 };

/** Un champ et un bouton, avec le message de refus du serveur (« Ce joueur existe déjà »). */
export function InlineForm({
  action,
  field,
  label,
  submit,
  playerId,
  defaultValue = "",
}: {
  action: Action;
  field: string;
  label: string;
  submit: string;
  playerId?: number;
  defaultValue?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex gap-2">
        {playerId === undefined ? null : <input type="hidden" name="id" value={playerId} />}
        <Input
          key={state.done}
          name={field}
          aria-label={label}
          placeholder={label}
          defaultValue={defaultValue}
          autoComplete="off"
          required
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {submit}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
