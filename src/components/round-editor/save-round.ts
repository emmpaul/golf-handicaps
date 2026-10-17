import type { RoundForm } from "@/scorecard/checks";

export type SaveTarget =
  | { kind: "create"; importId?: number }
  | { kind: "update"; roundId: number };

export type SaveResult =
  | { kind: "saved"; id: number }
  | { kind: "duplicate"; duplicateOf: number; message: string }
  | { kind: "refused"; message: string };

/** Envoie le round au serveur, qui rejoue les contrôles et cherche un doublon. */
export async function saveRound(
  target: SaveTarget,
  form: RoundForm,
  force: boolean,
): Promise<SaveResult> {
  const create = target.kind === "create";
  const response = await fetch(create ? "/api/rounds" : `/api/rounds/${target.roundId}`, {
    method: create ? "POST" : "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(create ? { form, importId: target.importId, force } : { form, force }),
  });
  const body = await response.json().catch(() => ({}));
  if (response.ok) return { kind: "saved", id: body.id };
  if (response.status === 409) {
    return { kind: "duplicate", duplicateOf: body.duplicateOf, message: body.error };
  }
  return { kind: "refused", message: body.error ?? "Enregistrement impossible" };
}
