import { getDb } from "@/db/instance";
import { getImportStatus } from "@/jobs/imports";

/** État d'un import, interrogé par l'UI tant qu'il est en attente ou en cours de lecture. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const status = getImportStatus(getDb(), Number(id));
  if (!status) return Response.json({ error: "Import introuvable" }, { status: 404 });
  return Response.json(status);
}
