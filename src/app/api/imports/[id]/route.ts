import { getDb } from "@/db/instance";
import { deleteImport, getImportStatus, removeUnreferencedPhoto } from "@/jobs/imports";
import { getEnv } from "@/lib/env";
import { IMPORT_REFUSALS, refusalResponse } from "@/server/imports/refusals";

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

/**
 * Suppression d'un import pas encore enregistré en round, avec son job en file. Sa photo est
 * effacée après la transaction (design, décision 3). 204 une fois supprimé. Session vérifiée
 * par le proxy.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return refusalResponse(IMPORT_REFUSALS["not-found"]);
  const db = getDb();
  const deleted = deleteImport(db, Number(id));
  if (deleted.result !== "deleted") return refusalResponse(IMPORT_REFUSALS[deleted.result]);
  await removeUnreferencedPhoto(db, getEnv().DATA_DIR, deleted.photoPath);
  return new Response(null, { status: 204 });
}
