import { getDb } from "@/db/instance";
import { getImportStatus, parseCorners, recropImport } from "@/jobs/imports";

const error = (message: string, status: number) => Response.json({ error: message }, { status });

/**
 * Recadrage d'un import en « Échec » : le corps est le JSON des 4 coins (0–1). L'import
 * repasse « En attente » avec un nouveau job de lecture. Session vérifiée par le proxy.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return error("Import introuvable", 404);
  const corners = parseCorners(await request.text());
  if (!corners) return error("Coins du panneau invalides", 400);
  const db = getDb();
  const result = recropImport(db, Number(id), corners, new Date());
  if (result === "not-found") return error("Import introuvable", 404);
  if (result === "not-failed") return error("Seul un import en échec peut être recadré", 409);
  return Response.json(getImportStatus(db, Number(id)));
}
