"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPlayerAction } from "@/app/(app)/players/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { checkRoundForm, problemCountLabel } from "@/scorecard/checks";
import type { DraftValue } from "@/scorecard/draft";
import { useCorrectionAutosave } from "./autosave";
import {
  applyCourse,
  courseLabel,
  type EditorState,
  type KnownCourse,
  lineLabel,
  MAX_LINES,
  newLine,
  type PlayerOption,
  removeLine,
  toRoundForm,
  withoutAiCell,
} from "./form-state";
import { LinePlayers } from "./line-players";
import { ProblemList } from "./problem-list";
import { type SaveTarget, saveRound } from "./save-round";
import {
  AI_CELL_CLASS,
  AI_DESCRIPTION,
  AiMark,
  type GridColumn,
  type GridRow,
  ScoreGrid,
} from "./score-grid";

type Notice =
  | { kind: "duplicate"; roundId: number; message: string }
  | { kind: "error"; message: string };

function setHoleRow<T extends { holes: DraftValue[] }>(
  row: T,
  column: GridColumn,
  value: DraftValue,
): T {
  if (typeof column === "number") {
    const holes = [...row.holes];
    holes[column - 1] = value;
    return { ...row, holes };
  }
  return { ...row, [column]: value };
}

function updateCell(state: EditorState, row: string, column: GridColumn, value: DraftValue) {
  return setCell(withoutAiCell(state, `${row}:${column}`), row, column, value);
}

function setCell(state: EditorState, row: string, column: GridColumn, value: DraftValue) {
  const { form } = state;
  if (row === "par" || row === "distance") {
    return { ...state, form: { ...form, [row]: setHoleRow(form[row], column, value) } };
  }
  if (row === "strokeIndex" && typeof column === "number") {
    const strokeIndex = [...form.strokeIndex];
    strokeIndex[column - 1] = value;
    return { ...state, form: { ...form, strokeIndex } };
  }
  const position = Number(row.replace("player", ""));
  return {
    ...state,
    lines: state.lines.map((line, i) =>
      i === position ? { ...line, scores: setHoleRow(line.scores, column, value) } : line,
    ),
  };
}

function gridRows(state: EditorState, players: readonly PlayerOption[]): GridRow[] {
  const form = toRoundForm(state);
  const totals = (row: typeof form.par, editable: boolean) => ({
    out: row.out,
    in: row.in,
    total: row.total,
    editable,
  });
  return [
    {
      key: "par",
      label: "Par",
      holes: form.par.holes,
      totals: totals(form.par, state.readCardTotals),
    },
    { key: "strokeIndex", label: "Index", holes: form.strokeIndex },
    {
      key: "distance",
      label: "Distance",
      holes: form.distance.holes,
      totals: totals(form.distance, state.readCardTotals),
    },
    ...form.players.map((row, i) => ({
      key: `player${i}`,
      label: lineLabel(state.lines[i], i, players),
      cellLabel: `Ligne ${i + 1}`,
      holes: row.scores.holes,
      totals: totals(row.scores, state.lines[i].readTotals),
    })),
  ];
}

/**
 * Écran de correction, partagé par l'import, la saisie manuelle et la correction d'un
 * round. Les contrôles de cohérence se recalculent à chaque modification ; le bouton
 * d'enregistrement compte les problèmes restants. `aiNote` : message de la complétion par
 * l'IA, affiché au-dessus de la grille.
 */
export function RoundEditor({
  initial,
  players,
  courses,
  photoUrl,
  aiNote,
  target,
}: {
  initial: EditorState;
  players: PlayerOption[];
  courses?: KnownCourse[];
  photoUrl?: string;
  aiNote?: string | null;
  target: SaveTarget;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [playerOptions, setPlayerOptions] = useState(players);
  const hasCourses = courses !== undefined && courses.length > 0;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useMemo(() => toRoundForm(state), [state]);
  const problems = useMemo(() => checkRoundForm(form), [form]);
  const invalid = useMemo(() => new Set(problems.flatMap(({ cells }) => cells)), [problems]);
  const aiCells = useMemo(() => new Set(state.aiCells), [state.aiCells]);
  // Sauvegarde automatique : correction d'un import seulement.
  const autosave = useCorrectionAutosave(
    target.kind === "create" ? (target.importId ?? null) : null,
    state,
  );

  function change(next: EditorState) {
    setState(next);
    setNotice(null);
  }

  function setField(field: "courseName" | "tees" | "playedOn", value: string) {
    const next = withoutAiCell(state, field);
    change({ ...next, form: { ...next.form, [field]: value || null } });
  }

  function associate(key: number, playerId: number | null) {
    // Mise à jour fonctionnelle : appelée aussi après la création d'un joueur (asynchrone).
    setState((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.key === key ? { ...line, playerId } : line)),
    }));
    setNotice(null);
  }

  async function createPlayer(key: number, name: string): Promise<string | null> {
    const created = await createPlayerAction(name);
    if (!created.player) return created.error;
    const { player } = created;
    setPlayerOptions((options) =>
      [...options, player].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    );
    associate(key, player.id);
    return null;
  }

  async function submit(force: boolean) {
    autosave.pause();
    setSaving(true);
    // Round non enregistré (doublon, refus, erreur réseau) : la sauvegarde reprend.
    let saved = false;
    try {
      const result = await saveRound(target, form, force);
      if (result.kind === "saved") {
        saved = true;
        router.push(target.kind === "create" ? "/rounds" : `/rounds/${result.id}`);
        router.refresh();
        return;
      }
      setNotice(
        result.kind === "duplicate"
          ? { kind: "duplicate", roundId: result.duplicateOf, message: result.message }
          : { kind: "error", message: result.message },
      );
    } finally {
      setSaving(false);
      if (!saved) autosave.resume();
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Sur ordinateur, la photo se place à côté des champs : la grille tient sans défiler. */}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        {photoUrl ? (
          <a href={photoUrl} target="_blank" rel="noreferrer" className="self-start lg:shrink-0">
            {/* biome-ignore lint/performance/noImgElement: servie par une route authentifiée. */}
            <img
              src={photoUrl}
              alt="Carte importée"
              className="max-h-72 w-full rounded-lg border object-contain lg:h-72 lg:w-auto"
            />
          </a>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <FieldGroup className="gap-4">
            <div
              className={cn(
                "grid grid-cols-1 gap-4 sm:grid-cols-3",
                hasCourses && "lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]",
              )}
            >
              {/* Sur ordinateur, le parcours connu se place sur la même ligne que les champs. */}
              {hasCourses ? (
                <Field className="sm:col-span-3 lg:col-span-1">
                  <FieldLabel htmlFor="known-course">Parcours connu</FieldLabel>
                  <NativeSelect
                    id="known-course"
                    defaultValue=""
                    onChange={(event) => {
                      const course = courses[Number(event.currentTarget.value)];
                      if (course) change(applyCourse(state, course));
                    }}
                  >
                    <NativeSelectOption value="">Choisir un parcours</NativeSelectOption>
                    {courses.map((course, i) => (
                      <NativeSelectOption key={courseLabel(course)} value={i}>
                        {courseLabel(course)}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
              {(
                [
                  { field: "courseName", label: "Parcours", type: "text" },
                  { field: "tees", label: "Tees", type: "text" },
                  { field: "playedOn", label: "Date", type: "date" },
                ] as const
              ).map(({ field, label, type }) => (
                <Field key={field}>
                  <FieldLabel htmlFor={field}>{label}</FieldLabel>
                  {/* Toujours enveloppé : retirer la marque ne remonte pas le champ en cours de saisie. */}
                  <div className="relative">
                    <Input
                      id={field}
                      type={type}
                      value={state.form[field] ?? ""}
                      aria-invalid={invalid.has(field) || undefined}
                      aria-description={aiCells.has(field) ? AI_DESCRIPTION : undefined}
                      className={cn(aiCells.has(field) && AI_CELL_CLASS)}
                      onChange={(event) => setField(field, event.currentTarget.value)}
                    />
                    {aiCells.has(field) ? <AiMark /> : null}
                  </div>
                </Field>
              ))}
            </div>
          </FieldGroup>
          <LinePlayers
            lines={state.lines}
            players={playerOptions}
            invalid={invalid}
            canAdd={state.lines.length < MAX_LINES}
            onAssociate={associate}
            onCreate={createPlayer}
            onRemove={(key) => change(removeLine(state, key))}
            onAdd={() => change({ ...state, lines: [...state.lines, newLine()] })}
          />
        </div>
      </div>
      {aiNote ? (
        <Alert>
          <AlertTitle>{aiNote}</AlertTitle>
        </Alert>
      ) : null}
      <ScoreGrid
        rows={gridRows(state, playerOptions)}
        invalid={invalid}
        aiCells={aiCells}
        onCell={(row, column, value) => change(updateCell(state, row, column, value))}
      />
      <ProblemList problems={problems} />
      {notice?.kind === "duplicate" ? (
        <Alert>
          <AlertTitle>{notice.message}</AlertTitle>
          <AlertDescription>
            <p>
              <Link href={`/rounds/${notice.roundId}`}>Voir le round existant</Link>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void submit(true)}>
                Enregistrer quand même
              </Button>
              <Button variant="outline" onClick={() => setNotice(null)}>
                Annuler
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {notice?.kind === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>{notice.message}</AlertTitle>
        </Alert>
      ) : null}
      <div className="sticky bottom-0 z-20 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 sm:flex-row sm:items-center">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={problems.length > 0 || saving}
          onClick={() => void submit(false)}
        >
          {problems.length > 0 ? problemCountLabel(problems.length) : "Enregistrer"}
        </Button>
        <p
          role="status"
          className={cn(
            "text-sm",
            autosave.status.error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {autosave.status.message}
        </p>
      </div>
    </div>
  );
}
