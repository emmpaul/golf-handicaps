import { ScoreMark } from "@/components/scores/score-mark";
import { ScrollFrame } from "@/components/scroll-frame";
import { NO_VALUE } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoundForm } from "@/scorecard/checks";
import type { DraftHoleRow } from "@/scorecard/draft";

const columns = [
  ...Array.from({ length: 9 }, (_, i) => i),
  "out",
  ...Array.from({ length: 9 }, (_, i) => i + 9),
  "in",
  "total",
] as const;
const totals = { out: "OUT", in: "IN", total: "TOT" };
const labelClass =
  "sticky left-0 z-10 w-24 min-w-24 max-w-24 truncate bg-background px-2 text-left font-medium";

export function RoundScorecard({ round }: { round: RoundForm }) {
  const rows: { key: string; label: string; values: DraftHoleRow; scores?: boolean }[] = [
    { key: "par", label: "Par", values: round.par },
    {
      key: "index",
      label: "Index",
      values: { holes: round.strokeIndex, out: null, in: null, total: null },
    },
    ...round.players.map((player, i) => ({
      key: `player-${i}`,
      label: player.name ?? NO_VALUE,
      values: player.scores,
      scores: true,
    })),
  ];
  return (
    <section aria-labelledby="scorecard-title" className="flex min-w-0 flex-col gap-3">
      <h2 id="scorecard-title" className="font-heading text-lg font-semibold">
        Carte de score
      </h2>
      <ScrollFrame label="Défilement de la carte de score" labelWidth="6rem">
        <table
          aria-label="Carte de score"
          className="w-full border-separate border-spacing-0 text-center text-sm tabular-nums"
        >
          <thead>
            <tr>
              <th scope="col" className={labelClass}>
                Trou
              </th>
              {columns.map((column) => (
                <th key={column} scope="col" className="min-w-11 px-1 py-2 font-medium">
                  {typeof column === "number" ? column + 1 : totals[column]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className={labelClass}>
                  {row.label}
                </th>
                {columns.map((column) => {
                  const hole = typeof column === "number";
                  const value = hole ? row.values.holes[column] : row.values[column];
                  const par = hole ? round.par.holes[column] : null;
                  return (
                    <td
                      key={column}
                      className={cn(
                        "min-w-11 border-t px-1 py-1",
                        !hole && "bg-muted font-semibold",
                      )}
                    >
                      {row.scores && value !== null && par !== null ? (
                        <ScoreMark strokes={value} par={par} />
                      ) : (
                        (value ?? "")
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollFrame>
    </section>
  );
}
