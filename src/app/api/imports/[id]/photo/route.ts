import { photoResponse } from "@/lib/photo-response";
import { requestDb } from "@/lib/request-db";
import { getImport } from "@/server/imports/correction";

/** Photo d'un import, affichée à côté de l'écran de correction. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return photoResponse(getImport(await requestDb(), Number(id))?.photoPath);
}
