import { cn } from "@/lib/utils";

export function ScoreMark({ strokes, par }: { strokes: number; par: number }) {
  const mark = strokes < par ? "birdie" : strokes > par ? "bogey" : undefined;
  return (
    <span
      data-mark={mark}
      className={cn(
        "inline-flex size-8 items-center justify-center tabular-nums",
        mark === "birdie" && "rounded-full border border-birdie",
        mark === "bogey" && "border border-bogey",
      )}
    >
      {strokes}
      {mark ? <span className="sr-only">, {mark}</span> : null}
    </span>
  );
}
