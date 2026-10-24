"use client";

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

/** Description accessible d'une case remplie par l'IA (spec `scorecard-ai-completion`). */
export const AI_DESCRIPTION = "complété par l'IA";

/**
 * Fond teinté d'une case remplie par l'IA, dans la teinte `--ai` (bleu-violet), pour ne pas
 * se confondre avec le gris des cases en lecture seule. La variante sombre l'emporte aussi
 * sur le fond sombre propre au composant `Input`.
 */
export const AI_CELL_CLASS = "bg-ai/15 dark:bg-ai/25";

/** Pastille d'une case remplie par l'IA, dans un parent `relative`. */
export function AiMark() {
  return (
    <span
      aria-hidden
      data-testid="ai-mark"
      className="pointer-events-none absolute top-1 right-1 size-1.5 rounded-full bg-ai"
    />
  );
}

const columnTitle = (column: GridColumn) =>
  typeof column === "number" ? String(column) : TOTAL_LABELS[column];

function GridCell({
  label,
  value,
  invalid,
  ai,
  readOnly,
  onChange,
}: {
  label: string;
  value: DraftValue;
  invalid: boolean;
  ai: boolean;
  readOnly: boolean;
  onChange: (value: DraftValue) => void;
}) {
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-description={ai ? AI_DESCRIPTION : undefined}
      inputMode="numeric"
      autoComplete="off"
      readOnly={readOnly}
      value={value ?? ""}
      onChange={(event) => onChange(parseCell(event.currentTarget.value))}
      className={cn(
        "h-9 w-11 rounded-md lg:w-full border border-input bg-transparent px-0.5 text-center text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
        "aria-invalid:border-destructive aria-invalid:bg-destructive/10 aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        readOnly && "border-transparent bg-muted font-medium",
        ai && AI_CELL_CLASS,
      )}
    />
  );
}

/**
 * Grille de la carte (colonnes 1-9, OUT, 10-18, IN, TOT). Elle défile seule à
 * l'horizontale sur téléphone, la page ne déborde pas. Les cases de `aiCells` portent la
 * marque « complété par l'IA ».
 */
export function ScoreGrid({
  rows,
  invalid,
  aiCells,
  onCell,
}: {
  rows: GridRow[];
  invalid: ReadonlySet<string>;
  aiCells: ReadonlySet<string>;
  onCell: (row: string, column: GridColumn, value: DraftValue) => void;
}) {
  function cellValue(row: GridRow, column: GridColumn): DraftValue | undefined {
    if (typeof column === "number") return row.holes[column - 1];
    return row.totals?.[column];
  }

  return (
    <ScrollFrame label="Carte à corriger" labelWidth="6rem">
      <table className="border-separate border-spacing-0.5 p-1 text-sm tabular-nums lg:w-full">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 w-24 min-w-24 max-w-24 truncate bg-background px-2 text-left"
            >
              Trou
            </th>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className="px-0.5 text-center font-medium">
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
                className="sticky left-0 z-10 w-24 min-w-24 max-w-24 truncate bg-background px-2 text-left font-medium whitespace-nowrap"
              >
                {row.label}
              </th>
              {COLUMNS.map((column) => {
                const value = cellValue(row, column);
                const isHole = typeof column === "number";
                const key = `${row.key}:${column}`;
                const ai = aiCells.has(key);
                if (value === undefined) return <td key={column} />;
                return (
                  <td key={column} className={cn(ai && "relative")}>
                    <GridCell
                      label={
                        isHole
                          ? `${row.cellLabel ?? row.label} trou ${column}`
                          : `${row.cellLabel ?? row.label} ${TOTAL_LABELS[column]}`
                      }
                      value={value}
                      invalid={invalid.has(key)}
                      ai={ai}
                      readOnly={!isHole && !row.totals?.editable}
                      onChange={(next) => onCell(row.key, column, next)}
                    />
                    {ai ? <AiMark /> : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollFrame>
  );
}
