import { getDb } from "@/db/instance";
import type { RoundForm } from "@/scorecard/checks";
import { learnAliasesFromForm } from "@/server/players/learn-from-form";
import { postRound } from "@/server/rounds/http";

/**
 * Enregistrement d'un round (JSON `{ form, importId?, force? }`), puis apprentissage des
 * alias des lignes associées à la main. La session est vérifiée par le proxy : sans
 * session, `/api/*` répond 401.
 */
export async function POST(request: Request): Promise<Response> {
  const db = getDb();
  const body = await request.json().catch(() => null);
  const response = postRound(db, body);
  // 201 : le corps a passé la validation de `postRound`.
  if (response.status === 201) learnAliasesFromForm(db, (body as { form: RoundForm }).form);
  return response;
}
