"use client";

import { useActionState } from "react";
import { type CourseFormState, saveManualRatingAction } from "@/app/(app)/courses/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Pending } from "@/components/ui/pending";

const initialState: CourseFormState = { error: null, done: 0 };

/**
 * Saisie ou correction de la rating et du slope à la main (spec `course-rating`). Le serveur
 * contrôle les bornes et renvoie « Rating entre 40,0 et 90,0 » ou « Slope entre 55 et 155 ».
 */
export function ManualRatingForm({
  courseId,
  course,
  defaultRating,
  defaultSlope,
}: {
  courseId: number;
  /** « BETHPAGE BLACK / Red », pour nommer les champs d'un parcours parmi les autres. */
  course: string;
  defaultRating: string;
  defaultSlope: string;
}) {
  const [state, formAction, pending] = useActionState(saveManualRatingAction, initialState);
  const invalid = state.error !== null || undefined;
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={courseId} />
      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-24" data-invalid={invalid}>
          <FieldLabel htmlFor={`rating-${courseId}`}>Rating</FieldLabel>
          <Input
            key={`rating-${state.done}`}
            id={`rating-${courseId}`}
            name="rating"
            inputMode="decimal"
            autoComplete="off"
            aria-label={`Rating de ${course}`}
            aria-invalid={invalid}
            defaultValue={defaultRating}
            placeholder="71,4"
          />
        </Field>
        <Field className="w-20" data-invalid={invalid}>
          <FieldLabel htmlFor={`slope-${courseId}`}>Slope</FieldLabel>
          <Input
            key={`slope-${state.done}`}
            id={`slope-${courseId}`}
            name="slope"
            inputMode="numeric"
            autoComplete="off"
            aria-label={`Slope de ${course}`}
            aria-invalid={invalid}
            defaultValue={defaultSlope}
            placeholder="144"
          />
        </Field>
        <Button type="submit" variant="outline" disabled={pending}>
          Enregistrer
        </Button>
      </div>
      <Pending label={pending ? "Enregistrement de la rating…" : null} orb="save" />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
