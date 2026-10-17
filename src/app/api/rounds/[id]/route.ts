import { getDb } from "@/db/instance";
import { deleteRoundRequest, putRound } from "@/server/rounds/http";

type Context = { params: Promise<{ id: string }> };

/** Correction d'un round (JSON `{ form, force? }`). Session vérifiée par le proxy. */
export async function PUT(request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return putRound(getDb(), id, await request.json().catch(() => null));
}

/** Suppression d'un round, après confirmation dans l'UI. Session vérifiée par le proxy. */
export async function DELETE(_request: Request, context: Context): Promise<Response> {
  const { id } = await context.params;
  return deleteRoundRequest(getDb(), id);
}
