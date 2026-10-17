"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { type LoginState, login } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="passcode" className="text-sm font-medium">
        Code d'accès
      </label>
      <input
        id="passcode"
        name="passcode"
        type="password"
        autoComplete="current-password"
        required
        className="h-10 rounded-lg border border-input bg-background px-3 text-base"
      />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        Entrer
      </Button>
    </form>
  );
}
