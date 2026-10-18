import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { getEnv } from "@/lib/env";

/** Type servi selon l'extension du chemin stocké : les JPEG non convertis restent lisibles. */
const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/**
 * Sert une photo du volume de données (`DATA_DIR/uploads/…`). Le chemin vient de la base,
 * jamais de la requête ; la session est vérifiée par le proxy (design, décision 6).
 */
export async function photoResponse(photoPath: string | null | undefined): Promise<Response> {
  if (!photoPath) return Response.json({ error: "Photo introuvable" }, { status: 404 });
  try {
    const photo = await readFile(join(getEnv().DATA_DIR, photoPath));
    const contentType = CONTENT_TYPES[extname(photoPath).toLowerCase()] ?? "image/jpeg";
    return new Response(new Uint8Array(photo), {
      headers: { "content-type": contentType, "cache-control": "private, max-age=86400" },
    });
  } catch {
    return Response.json({ error: "Photo introuvable" }, { status: 404 });
  }
}
