"use client";

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

const columnTitle = (column: GridColumn) =>
  typeof column === "number" ? String(column) : TOTAL_LABELS[column];

function GridCell({
  label,
  value,
  invalid,
  readOnly,
  onChange,
}: {
  label: string;
  value: DraftValue;
  invalid: boolean;
  readOnly: boolean;
  onChange: (value: DraftValue) => void;
}) {
  return (
    <input
      aria-label={label}
      aria-invalid={invalid || undefined}
      inputMode="numeric"
      autoComplete="off"
      readOnly={readOnly}
      value={value ?? ""}
      onChange={(event) => onChange(parseCell(event.currentTarget.value))}
      className={cn(
        "h-9 w-11 rounded-md lg:w-full border border-input bg-transparent px-0.5 text-center text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
        "aria-invalid:border-destructive aria-invalid:bg-destructive/10 aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        readOnly && "border-transparent bg-muted font-medium",
      )}
    />
  );
}

/**
 * Grille de la carte (colonnes 1-9, OUT, 10-18, IN, TOT). Elle défile seule à
 * l'horizontale sur téléphone, la page ne déborde pas.
 */
export function ScoreGrid({
  rows,
  invalid,
  onCell,
}: {
  rows: GridRow[];
  invalid: ReadonlySet<string>;
  onCell: (row: string, column: GridColumn, value: DraftValue) => void;
}) {
  function cellValue(row: GridRow, column: GridColumn): DraftValue | undefined {
    if (typeof column === "number") return row.holes[column - 1];
    return row.totals?.[column];
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-lg border">
      <table className="border-separate border-spacing-0.5 p-1 text-sm lg:w-full">
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-background px-2 text-left">
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
                className="sticky left-0 z-10 bg-background px-2 text-left font-medium whitespace-nowrap"
              >
                {row.label}
              </th>
              {COLUMNS.map((column) => {
                const value = cellValue(row, column);
                const isHole = typeof column === "number";
                if (value === undefined) return <td key={column} />;
                return (
                  <td key={column}>
                    <GridCell
                      label={
                        isHole
                          ? `${row.cellLabel ?? row.label} trou ${column}`
                          : `${row.cellLabel ?? row.label} ${TOTAL_LABELS[column]}`
                      }
                      value={value}
                      invalid={invalid.has(`${row.key}:${column}`)}
                      readOnly={!isHole && !row.totals?.editable}
                      onChange={(next) => onCell(row.key, column, next)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
