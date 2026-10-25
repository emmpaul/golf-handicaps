"use client";

import { useSyncExternalStore } from "react";
import { ScrollFrame } from "@/components/scroll-frame";
import { cn } from "@/lib/utils";
import type { DraftValue } from "@/scorecard/draft";
import { parseCell } from "./form-state";

export type GridColumn = number | "out" | "in" | "total";

/**
 * Une ligne de la grille ; `key` est le préfixe des clés de case des contrôles. `cellLabel`
 * préfixe le nom accessible des cases (`label` par défaut) : il reste stable quand le
 * libellé affiché change, par exemple « Ligne 1 » pour la ligne affichée « Gab ».
 */
export type GridRow = {
  key: string;
  label: string;
  cellLabel?: string;
  holes: DraftValue[];
  totals?: { out: DraftValue; in: DraftValue; total: DraftValue; editable: boolean };
};

const TOTAL_LABELS = { out: "OUT", in: "IN", total: "TOT" } as const;

const COLUMNS: GridColumn[] = [
  ...Array.from({ length: 9 }, (_, i) => i + 1),
  "out",
  ...Array.from({ length: 9 }, (_, i) => i + 10),
  "in",
  "total",
];

/** Ligne de la carte dont la valeur se place sous le numéro du trou en grille de téléphone. */
const DISTANCE_ROW = "distance";

/** Description accessible d'une case remplie par l'IA (spec `scorecard-ai-completion`). */
export const AI_DESCRIPTION = "complété par l'IA";

/**
 * Fond teinté d'une case remplie par l'IA, dans la teinte `--ai` (sarcelle), pour ne pas se
 * confondre avec le gris des cases en lecture seule. La variante sombre l'emporte aussi sur le
 * fond propre au composant `Input`.
 */
export const AI_CELL_CLASS = "bg-ai/15 dark:bg-ai/25";

/** Marque d'une case remplie par l'IA, dans un parent `relative`. */
export function AiMark() {
  return (
    <span
      aria-hidden
      data-testid="ai-mark"
      className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-ai"
    />
  );
}

/** Grille large (une colonne par trou) à partir de 768 px ; une ligne par trou en dessous. */
const WIDE_QUERY = "(width >= 48rem)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Disposition rendue (design D9) : une seule à la fois, pour ne pas dupliquer les champs. Le
 * serveur ne connaît pas la largeur : il rend celle du téléphone, l'usage principal.
 */
function useWideGrid() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

const columnTitle = (column: GridColumn) =>
  typeof column === "number" ? String(column) : TOTAL_LABELS[column];

const cellKey = (row: GridRow, column: GridColumn) => `${row.key}:${column}`;

function cellValue(row: GridRow, column: GridColumn): DraftValue | undefined {
  if (typeof column === "number") return row.holes[column - 1];
  return row.totals?.[column];
}

function cellName(row: GridRow, column: GridColumn) {
  const prefix = row.cellLabel ?? row.label;
  return typeof column === "number"
    ? `${prefix} trou ${column}`
    : `${prefix} ${TOTAL_LABELS[column]}`;
}

type GridProps = {
  rows: GridRow[];
  invalid: ReadonlySet<string>;
  aiCells: ReadonlySet<string>;
  onCell: (row: string, column: GridColumn, value: DraftValue) => void;
  onLeave?: (cell: string) => void;
};

/**
 * Case de la grille, ou rien quand la ligne n'a pas de valeur dans cette colonne (index des
 * totaux). Même nom accessible et même clé dans les deux dispositions.
 */
function GridCell({
  row,
  column,
  invalid,
  aiCells,
  onCell,
  onLeave,
  className,
}: Omit<GridProps, "rows"> & { row: GridRow; column: GridColumn; className?: string }) {
  const value = cellValue(row, column);
  if (value === undefined) return null;
  const key = cellKey(row, column);
  const ai = aiCells.has(key);
  const readOnly = typeof column !== "number" && !row.totals?.editable;
  return (
    <CellInput
      label={cellName(row, column)}
      value={value}
      invalid={invalid.has(key)}
      ai={ai}
      readOnly={readOnly}
      onChange={(next) => onCell(row.key, column, next)}
      onBlur={() => onLeave?.(key)}
      className={className}
    />
  );
}

/** Champ d'une case : texte saisi lu par `parseCell`, marque IA posée dans un parent `relative`. */
function CellInput({
  label,
  value,
  invalid,
  ai,
  readOnly,
  onChange,
  onBlur,
  className,
}: {
  label: string;
  value: DraftValue;
  invalid: boolean;
  ai: boolean;
  readOnly: boolean;
  onChange: (value: DraftValue) => void;
  onBlur: () => void;
  className?: string;
}) {
  return (
    <span className="relative block">
      <input
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-description={ai ? AI_DESCRIPTION : undefined}
        inputMode="numeric"
        autoComplete="off"
        readOnly={readOnly}
        value={value ?? ""}
        onChange={(event) => onChange(parseCell(event.currentTarget.value))}
        onBlur={onBlur}
        className={cn(
          "block w-full min-w-0 rounded-none border border-input bg-transparent px-0.5 text-center font-heading text-base font-semibold tabular-nums",
          "transition-[background-color,border-color] duration-(--dur-micro) ease-out outline-none",
          "hover:not-read-only:border-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring",
          "aria-invalid:border-destructive aria-invalid:bg-destructive/10",
          readOnly && "border-transparent bg-muted font-extrabold",
          ai && AI_CELL_CLASS,
          className,
        )}
      />
      {ai ? <AiMark /> : null}
    </span>
  );
}

/** Grille large : une rangée par ligne de la carte, colonnes 1-9, OUT, 10-18, IN, TOT. */
function WideGrid({ rows, ...cell }: GridProps) {
  return (
    <ScrollFrame label="Carte à corriger" labelWidth="6rem">
      <table className="border-separate border-spacing-0.5 p-1 text-sm tabular-nums lg:w-full">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 w-24 max-w-24 min-w-24 truncate bg-background px-2 text-left font-medium"
            >
              Trou
            </th>
            {COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-0.5 text-center font-heading text-base font-extrabold"
              >
                {columnTitle(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th
                scope="row"
                className={cn(
                  "sticky left-0 z-10 w-24 max-w-24 min-w-24 truncate bg-background px-2 text-left whitespace-nowrap",
                  row.key.startsWith("player")
                    ? "font-heading text-base font-semibold"
                    : "font-medium text-muted-foreground",
                )}
              >
                {row.label}
              </th>
              {COLUMNS.map((column) => (
                <td key={column}>
                  <GridCell row={row} column={column} className="h-8 w-11 lg:w-full" {...cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollFrame>
  );
}

/**
 * Grille de téléphone (spec « Grille de correction sur téléphone ») : une ligne par trou, la
 * distance sous le numéro, puis par, index et une colonne par ligne de joueur ; OUT après le 9,
 * IN et TOT après le 18. La rangée des noms reste collée sous l'en-tête de l'app.
 */
function PhoneGrid({ rows, ...cell }: GridProps) {
  const distance = rows.find((row) => row.key === DISTANCE_ROW);
  const columns = rows.filter((row) => row !== distance);
  // Têtes posées en bas, sur une même ligne de 20 px : la dernière ligne de « Trou / Dist. »,
  // « Par », « Index » (texte 12 px) et les noms des joueurs (condensé 16 px) tombe sur une même
  // ligne de base. Sans `leading-5`, `text-xs` donnerait 16 px aux petites têtes et les monterait.
  const head =
    "sticky top-(--top-chrome) z-10 bg-band px-0.5 py-1.5 align-bottom leading-5 text-band-ink";
  const smallHead = "text-xs leading-5 font-medium";
  return (
    <section aria-label="Carte à corriger" className="min-w-0">
      <table className="w-full table-fixed border-separate border-spacing-0 tabular-nums">
        <thead>
          <tr>
            {/* La case de distance se pose sous le numéro du trou : la tête nomme les deux. */}
            <th scope="col" className={cn(head, smallHead, "w-11 text-left")}>
              Trou{" "}
              <abbr title="Distance" className="block no-underline">
                Dist.
              </abbr>
            </th>
            {columns.map((row) => (
              <th
                key={row.key}
                scope="col"
                className={cn(
                  head,
                  "text-center",
                  row.key.startsWith("player")
                    ? "font-heading text-base leading-5 font-semibold [overflow-wrap:anywhere]"
                    : smallHead,
                )}
              >
                {row.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COLUMNS.map((column) => {
            const total = typeof column !== "number";
            return (
              <tr key={column} className={cn(total && "bg-muted")}>
                <th
                  scope="row"
                  className={cn(
                    "border-b px-0.5 pt-1.5 pb-1 text-left align-bottom",
                    (column === 9 || column === 18) && "border-b-2 border-b-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "block font-heading leading-none",
                      total ? "text-sm font-extrabold" : "text-lg font-extrabold",
                    )}
                  >
                    {columnTitle(column)}
                  </span>
                  {distance ? (
                    <GridCell
                      row={distance}
                      column={column}
                      className="mt-1 h-11 text-sm font-medium text-muted-foreground"
                      {...cell}
                    />
                  ) : null}
                </th>
                {columns.map((row) => (
                  <td
                    key={row.key}
                    className={cn(
                      "border-b px-0.5 pb-1 align-bottom",
                      (column === 9 || column === 18) && "border-b-2 border-b-foreground",
                    )}
                  >
                    <GridCell row={row} column={column} className="h-11" {...cell} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Grille de la carte, en une seule disposition rendue à la fois : colonnes 1-9, OUT, 10-18, IN,
 * TOT à partir de 768 px (le cadre défile s'il le faut, avec ses fondus), une ligne par trou en
 * dessous, sans défilement de côté. Les cases gardent leur nom (« Ligne 1 trou 9 ») et leur clé
 * dans les deux. Les cases de `aiCells` portent la marque « complété par l'IA » ; `onLeave`
 * reçoit la clé d'une case quand elle perd le focus.
 */
export function ScoreGrid(props: GridProps) {
  return useWideGrid() ? <WideGrid {...props} /> : <PhoneGrid {...props} />;
}
