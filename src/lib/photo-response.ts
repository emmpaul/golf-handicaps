import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getEnv } from "@/lib/env";

/**
 * Sert une photo du volume de données (`DATA_DIR/uploads/…`). Le chemin vient de la base,
 * jamais de la requête ; la session est vérifiée par le proxy (design, décision 6).
 */
export async function photoResponse(photoPath: string | null | undefined): Promise<Response> {
  if (!photoPath) return Response.json({ error: "Photo introuvable" }, { status: 404 });
  try {
    const photo = await readFile(join(getEnv().DATA_DIR, photoPath));
    return new Response(new Uint8Array(photo), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch {
    return Response.json({ error: "Photo introuvable" }, { status: 404 });
  }
}
