"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Pending } from "@/components/ui/pending";
import { type LoginState, login } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label htmlFor="passcode" className="text-sm font-medium">
        Code d'accès
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "passcode-error" : undefined}
        className="h-11 rounded-none border border-input bg-background px-3 text-base transition-[border-color] duration-(--dur-micro) ease-out hover:border-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive"
      />
      {state.error ? (
        <p id="passcode-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="mt-2 w-full">
        Entrer
      </Button>
      <Pending label={pending ? "Connexion…" : null} orb="send" />
    </form>
  );
}
