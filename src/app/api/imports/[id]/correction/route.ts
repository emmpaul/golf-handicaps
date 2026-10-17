import { getDb } from "@/db/instance";
import { type SaveCorrectionResult, saveCorrection } from "@/server/imports/correction";

const error = (message: string, status: number) => Response.json({ error: message }, { status });

const REFUSALS: Record<Exclude<SaveCorrectionResult, "ok">, [string, number]> = {
  invalid: ["Requête invalide", 400],
  "not-found": ["Import introuvable", 404],
  "already-saved": ["Cette carte est déjà enregistrée", 409],
  reading: ["Lecture en cours", 409],
};

/**
 * Sauvegarde automatique de l'écran de correction d'un import : le corps est le JSON de la
 * correction enregistrée. 204 une fois écrite. Session vérifiée par le proxy.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const raw: unknown = await request.json().catch(() => undefined);
  const result = saveCorrection(getDb(), id, raw);
  if (result === "ok") return new Response(null, { status: 204 });
  return error(...REFUSALS[result]);
}
