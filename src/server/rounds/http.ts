import { z } from "zod";
import type { Db } from "@/db/client";
import { removeUnreferencedPhoto } from "@/jobs/imports";
import type { RoundForm } from "@/scorecard/checks";
import { cardSchema, holeRow, value } from "@/scorecard/form-schema";
import { findDuplicateRound } from "./courses";
import { deleteRound, RoundNotFoundError, updateRound } from "./edit";
import { assertCoherent, ImportNotFoundError, RoundCheckError, saveRound } from "./save";

export const DUPLICATE_ROUND = "Ce round semble déjà enregistré";

const formSchema = cardSchema.extend({
  players: z.array(z.object({ name: z.string().nullable(), playerId: value, scores: holeRow })),
}) satisfies z.ZodType<RoundForm>;

const bodySchema = z.object({
  form: formSchema,
  importId: z.number().int().optional(),
  /** L'utilisateur a vu l'avertissement de doublon et enregistre quand même. */
  force: z.boolean().optional(),
});

type Body = z.infer<typeof bodySchema>;

const error = (message: string, status: number, extra: object = {}) =>
  Response.json({ error: message, ...extra }, { status });

/** Traduit les refus métier en réponses HTTP ; toute autre erreur remonte (500). */
function handle(write: () => Response): Response {
  try {
    return write();
  } catch (failure) {
    if (failure instanceof RoundCheckError) {
      return error(failure.message, 422, { problems: failure.problems });
    }
    if (failure instanceof RoundNotFoundError || failure instanceof ImportNotFoundError) {
      return error(failure.message, 404);
    }
    throw failure;
  }
}

function withBody(raw: unknown, write: (body: Body) => Response): Response {
  const parsed = bodySchema.safeParse(raw);
  return parsed.success ? handle(() => write(parsed.data)) : error("Requête invalide", 400);
}

function duplicateOf(db: Db, body: Body, excludeRoundId?: number): Response | null {
  if (body.force) return null;
  const existing = findDuplicateRound(db, body.form, { excludeRoundId });
  return existing === null ? null : error(DUPLICATE_ROUND, 409, { duplicateOf: existing });
}

function parseRoundId(id: string): number | null {
  return /^\d+$/.test(id) ? Number(id) : null;
}

const notFound = () => error(new RoundNotFoundError().message, 404);

/** `POST /api/rounds` : contrôles, puis avertissement de doublon, puis enregistrement. */
export function postRound(db: Db, raw: unknown): Response {
  return withBody(raw, (body) => {
    assertCoherent(body.form);
    return (
      duplicateOf(db, body) ??
      Response.json({ id: saveRound(db, body.form, { importId: body.importId }) }, { status: 201 })
    );
  });
}

/** `PUT /api/rounds/:id` : correction d'un round, mêmes contrôles que l'import. */
export function putRound(db: Db, id: string, raw: unknown): Response {
  const roundId = parseRoundId(id);
  if (roundId === null) return notFound();
  return withBody(raw, (body) => {
    assertCoherent(body.form);
    const duplicate = duplicateOf(db, body, roundId);
    if (duplicate) return duplicate;
    updateRound(db, roundId, body.form);
    return Response.json({ id: roundId });
  });
}

/**
 * `DELETE /api/rounds/:id` : suppression confirmée côté UI, index recalculés. La photo d'un round
 * importé est effacée après la transaction, si plus rien ne la porte (design, décision 3).
 */
export async function deleteRoundRequest(db: Db, dataDir: string, id: string): Promise<Response> {
  const roundId = parseRoundId(id);
  if (roundId === null) return notFound();
  let photoPath: string | null = null;
  const response = handle(() => {
    photoPath = deleteRound(db, roundId).photoPath;
    return new Response(null, { status: 204 });
  });
  if (photoPath !== null) await removeUnreferencedPhoto(db, dataDir, photoPath);
  return response;
}
