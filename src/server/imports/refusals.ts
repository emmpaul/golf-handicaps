import type { DeleteImportRefusal } from "@/jobs/imports";

/** Refus d'une écriture sur un import, communs à la correction et à la suppression. */
export const IMPORT_REFUSALS: Record<DeleteImportRefusal, [string, number]> = {
  "not-found": ["Import introuvable", 404],
  "already-saved": ["Cette carte est déjà enregistrée", 409],
  reading: ["Lecture en cours", 409],
};

/** Réponse JSON `{ error }` d'un refus. */
export const refusalResponse = ([message, status]: [string, number]) =>
  Response.json({ error: message }, { status });
