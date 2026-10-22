"use client";

import Link from "next/link";
import { useState } from "react";
import { courseLabel, type KnownCourse } from "@/components/round-editor/form-state";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { allocateStrokes, matchStrokes, type StrokeMode } from "@/domain/strokes";
import { formatTenths, NO_INDEX } from "@/lib/format";
import { ACTION_LINK, cn } from "@/lib/utils";
import type { RoundRating } from "@/server/courses/ratings";

export type PlannerPlayer = { id: number; name: string; indexT: number | null };

/** Parcours connu avec son par total et sa rating (confirmée ou repli par / 113). */
export type PlannerCourse = KnownCourse & { par: number; rating: RoundRating };

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const MODES: { mode: StrokeMode; label: string }[] = [
  { mode: "ecart", label: "Écart" },
  { mode: "complet", label: "Complet" },
];

const plural = (count: number) => (Math.abs(count) > 1 ? "coups" : "coup");

function totalLabel(name: string, strokes: number) {
  return strokes < 0
    ? `${name} rend ${-strokes} ${plural(strokes)}`
    : `${name} reçoit ${strokes} ${plural(strokes)}`;
}

/** « Trous : 4 (×2), 15 (×2), 1, … » dans l'ordre des trous, ou « Aucun coup ». */
function holesLabel(perHole: number[]) {
  const holes = perHole.flatMap((count, i) => {
    if (count === 0) return [];
    const times = Math.abs(count);
    return [times > 1 ? `${i + 1} (×${times})` : String(i + 1)];
  });
  return holes.length === 0 ? "Aucun coup" : `Trous : ${holes.join(", ")}`;
}

/**
 * Coups à donner avant une partie (spec `match-strokes`) : 2 à 4 joueurs avec un index,
 * un parcours connu, mode « Écart » par défaut ou « Complet ».
 */
export function StrokesPlanner({
  players,
  courses,
}: {
  players: PlannerPlayer[];
  courses: PlannerCourse[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [courseIndex, setCourseIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<StrokeMode>("ecart");
  const course = courseIndex === null ? undefined : courses[courseIndex];
  const chosen = players.filter((player) => selected.includes(player.id));
  const ready = course !== undefined && chosen.length >= MIN_PLAYERS;
  const strokes = ready
    ? matchStrokes(
        chosen.map((player) => player.indexT ?? 0),
        mode,
        // Sans rating confirmée : l'index arrondi (courseHandicap sans parcours).
        course.rating.rated
          ? { ratingT: course.rating.ratingT, slope: course.rating.slope, par: course.par }
          : undefined,
      )
    : [];

  function toggle(id: number, on: boolean) {
    setSelected((current) => (on ? [...current, id] : current.filter((other) => other !== id)));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-4">
        <FieldSet>
          <FieldLegend variant="label">Joueurs (2 à 4)</FieldLegend>
          <div className="flex flex-col gap-2">
            {players.map((player) => {
              const disabled =
                player.indexT === null ||
                (!selected.includes(player.id) && selected.length >= MAX_PLAYERS);
              return (
                <label
                  key={player.id}
                  data-testid={`player-choice-${player.name}`}
                  data-disabled={player.indexT === null || undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg border px-3",
                    player.indexT === null && "opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-primary"
                    disabled={disabled}
                    checked={selected.includes(player.id)}
                    onChange={(event) => toggle(player.id, event.currentTarget.checked)}
                  />
                  <span className="font-medium">{player.name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {player.indexT === null ? NO_INDEX : `Index ${formatTenths(player.indexT)}`}
                  </span>
                </label>
              );
            })}
          </div>
        </FieldSet>
        <Field>
          <FieldLabel htmlFor="course">Parcours</FieldLabel>
          <NativeSelect
            id="course"
            value={courseIndex ?? ""}
            onChange={(event) =>
              setCourseIndex(
                event.currentTarget.value === "" ? null : Number(event.currentTarget.value),
              )
            }
          >
            <NativeSelectOption value="">Choisir un parcours</NativeSelectOption>
            {courses.map((known, i) => (
              <NativeSelectOption key={courseLabel(known)} value={i}>
                {courseLabel(known)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {/* Rating du parcours choisi, lien vers la page Parcours (spec `match-strokes`). */}
        {course ? (
          <Link
            href="/courses"
            data-testid="course-rating"
            className={cn(ACTION_LINK, "-mt-2 w-fit text-sm")}
          >
            {course.rating.rated
              ? `Rating ${formatTenths(course.rating.ratingT)} · slope ${course.rating.slope}`
              : "sans rating"}
          </Link>
        ) : null}
        <FieldSet>
          <FieldLegend variant="label">Mode</FieldLegend>
          <div className="flex gap-2">
            {MODES.map((option) => (
              <label
                key={option.mode}
                className="flex min-h-11 items-center gap-2 rounded-lg border px-3 has-checked:border-primary"
              >
                <input
                  type="radio"
                  name="mode"
                  className="size-4 accent-primary"
                  checked={mode === option.mode}
                  onChange={() => setMode(option.mode)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </FieldSet>
      </div>
      {ready ? (
        <ul aria-label="Coups reçus" className="flex flex-col gap-2">
          {chosen.map((player, i) => (
            <li key={player.id} className="flex flex-col gap-1 rounded-lg border p-3">
              <span data-testid="strokes-total" className="font-medium">
                {totalLabel(player.name, strokes[i])}
              </span>
              <span data-testid="strokes-holes" className="text-sm text-muted-foreground">
                {holesLabel(allocateStrokes(strokes[i], course.strokeIndexes))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choisis 2 à 4 joueurs et un parcours pour voir les coups reçus.
        </p>
      )}
    </div>
  );
}
