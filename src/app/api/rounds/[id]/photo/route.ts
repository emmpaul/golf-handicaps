import { photoResponse } from "@/lib/photo-response";
import { requestDb } from "@/lib/request-db";
import { roundDetail } from "@/server/rounds/detail";

/** Photo d'origine d'un round importé (spec `scorecard-import`, conservation de la photo). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return photoResponse(roundDetail(await requestDb(), Number(id))?.photoPath);
}
