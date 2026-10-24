import { cn } from "@/lib/utils";

/** Aller puis retour, neuf trous par rangée même à 320 px. */
export function StrokesGrid({ perHole }: { perHole: number[] }) {
  return (
    <div data-testid="strokes-holes" className="grid min-w-0 grid-cols-9 gap-1 tabular-nums">
      {perHole.map((count, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed hole numbers never reorder.
          key={i + 1}
          role="img"
          aria-label={`Trou ${i + 1} : ${count === 0 ? "aucun coup" : `${count} ${Math.abs(count) > 1 ? "coups" : "coup"}`}`}
          className={cn(
            "flex min-w-0 flex-col items-center rounded py-1",
            count === 0 ? "bg-muted" : "bg-primary/15",
          )}
        >
          <span aria-hidden className="text-[10px] text-muted-foreground">
            {i + 1}
          </span>
          <span aria-hidden className="h-5 text-sm font-semibold">
            {count === 0 ? "" : count}
          </span>
        </div>
      ))}
    </div>
  );
}
