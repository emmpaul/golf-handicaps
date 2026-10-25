import { cn } from "@/lib/utils";

/**
 * Aller puis retour, neuf trous par rangée même à 320 px (spec `match-strokes`). Numéro du trou
 * en condensé ; un trou où le joueur reçoit un coup est en encre pleine.
 */
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
            "flex min-w-0 flex-col items-center py-1",
            count === 0 ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <span aria-hidden className="font-heading text-xs font-semibold">
            {i + 1}
          </span>
          <span aria-hidden className="h-6 font-heading text-lg leading-6 font-extrabold">
            {count === 0 ? "" : count}
          </span>
        </div>
      ))}
    </div>
  );
}
