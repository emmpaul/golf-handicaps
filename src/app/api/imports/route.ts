import { getDb } from "@/db/instance";
import { createImport, parseCorners } from "@/jobs/imports";
import { getEnv } from "@/lib/env";
import { requestDb } from "@/lib/request-db";
import { listImports } from "@/server/imports/list";

const badRequest = (error: string) => Response.json({ error }, { status: 400 });

/**
 * Upload multipart d'une photo de carte (`photo`, JPEG réencodé par le navigateur) et de ses
 * coins (`corners`, JSON normalisé 0–1). Met la lecture en file et rend la main tout de suite.
 * La session est vérifiée par le proxy : sans session, `/api/*` répond 401.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return badRequest("Photo manquante");
  const corners = parseCorners(form.get("corners"));
  if (!corners) return badRequest("Coins du panneau invalides");
  const { id } = createImport(
    getDb(),
    getEnv().DATA_DIR,
    { photo: Buffer.from(await photo.arrayBuffer()), corners },
    new Date(),
  );
  return Response.json({ id }, { status: 201 });
}

/** Derniers imports et leur état, interrogés par l'UI toutes les 2 s tant qu'un import attend. */
export async function GET(): Promise<Response> {
  return Response.json(listImports(await requestDb()));
}
