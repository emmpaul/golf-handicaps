import type { Problem } from "@/scorecard/checks";

/** Messages des contrôles, les identiques regroupés (« Case vide (×18) »). */
export function ProblemList({ problems }: { problems: Problem[] }) {
  const counts = new Map<string, number>();
  for (const { message } of problems) counts.set(message, (counts.get(message) ?? 0) + 1);
  if (counts.size === 0) return null;
  return (
    <ul aria-label="Problèmes" className="flex flex-col gap-1 text-sm text-destructive">
      {[...counts].map(([message, count]) => (
        <li key={message}>{count > 1 ? `${message} (×${count})` : message}</li>
      ))}
    </ul>
  );
}
