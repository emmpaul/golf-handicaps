"use client";

import { useActionState } from "react";
import type { CourseFormState } from "@/app/(app)/courses/actions";
import { Button } from "@/components/ui/button";
import { Pending } from "@/components/ui/pending";

type Action = (previous: CourseFormState, formData: FormData) => Promise<CourseFormState>;

const initialState: CourseFormState = { error: null, done: 0 };

/**
 * Bouton d'une action de la page Parcours (confirmer, choisir, relancer), avec le message de
 * refus du serveur. `fields` sont envoyés en champs cachés, à côté de l'id du parcours.
 */
export function CourseAction({
  action,
  courseId,
  fields = {},
  label,
  accessibleName,
  variant = "outline",
}: {
  action: Action;
  courseId: number;
  fields?: Record<string, string | number>;
  label: string;
  accessibleName?: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={courseId} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant={variant} disabled={pending} aria-label={accessibleName}>
        {label}
      </Button>
      <Pending label={pending ? "Enregistrement…" : null} orb="save" />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
