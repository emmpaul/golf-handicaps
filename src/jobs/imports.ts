import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import type { Db } from "@/db/client";
import { type importStatuses, imports, jobs, rounds } from "@/db/schema";
import type { Corners } from "@/ocr/corners";
import type { ScorecardDraft } from "@/scorecard/draft";
import { enqueueJob } from "./queue";

export type ImportStatus = (typeof importStatuses)[number];

export const OCR_SCORECARD_JOB = "ocr-scorecard";

export type OcrScorecardPayload = { importId: number };

const STATUS_LABELS: Record<ImportStatus, string> = {
  queued: "En attente",
  reading: "Lecture en cours",
  ready: "Prêt à vérifier",
  failed: "Échec",
};

export function importStatusLabel(status: ImportStatus): string {
  return STATUS_LABELS[status];
}

const point = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
const cornersSchema = z.object({
  topLeft: point,
  topRight: point,
  bottomRight: point,
  bottomLeft: point,
});

/** Coins envoyés par l'éditeur (JSON), chacun entre 0 et 1 ; `null` s'ils sont invalides. */
export function parseCorners(value: unknown): Corners | null {
  if (typeof value !== "string") return null;
  try {
    const result = cornersSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Photo telle qu'elle est gardée sur le disque : WebP avec perte, qualité 90 (design, décisions 1
 * et 2). `rotate()` applique l'orientation EXIF, que le WebP n'emporte pas. Rejette si le buffer
 * n'est pas une image que sharp sait décoder.
 */
export function toStoredWebp(photo: Buffer): Promise<Buffer> {
  return sharp(photo).rotate().webp({ quality: 90 }).toBuffer();
}

/** La photo envoyée n'est pas une image que sharp sait décoder (design, décision 1). */
export class UnreadablePhotoError extends Error {
  constructor(cause: unknown) {
    super("Photo illisible", { cause });
    this.name = "UnreadablePhotoError";
  }
}

/**
 * Convertit la photo en WebP et l'enregistre sous `DATA_DIR/uploads/<uuid>.webp` : le fichier
 * reçu n'est jamais écrit (design, décision 1). Crée ensuite l'import, sans coins (le worker
 * cherche le cadrage), et son job `ocr-scorecard` dans la même transaction (design de l'import,
 * décision 5.2). Rejette avec
 * `UnreadablePhotoError`, sans rien écrire, si la photo n'est pas une image lisible.
 */
export async function createImport(
  db: Db,
  dataDir: string,
  upload: { photo: Buffer },
  now: Date,
): Promise<{ id: number; photoPath: string }> {
  const webp = await toStoredWebp(upload.photo).catch((cause: unknown) => {
    throw new UnreadablePhotoError(cause);
  });
  const photoPath = `uploads/${randomUUID()}.webp`;
  const file = join(dataDir, photoPath);
  mkdirSync(join(dataDir, "uploads"), { recursive: true });
  writeFileSync(file, webp);
  try {
    return db.transaction((tx) => {
      const { id } = tx
        .insert(imports)
        .values({ photoPath, createdAt: now })
        .returning({ id: imports.id })
        .get();
      const payload: OcrScorecardPayload = { importId: id };
      enqueueJob(tx, OCR_SCORECARD_JOB, payload, now);
      return { id, photoPath };
    });
  } catch (error) {
    rmSync(file, { force: true });
    throw error;
  }
}

export type RecropResult = "queued" | "not-found" | "not-recroppable";

/** Import recadrable (design, décision 6) : en « Échec », ou « Prêt à vérifier » sans round. */
export function isRecroppable(row: { status: ImportStatus; roundId: number | null }): boolean {
  return row.status === "failed" || (row.status === "ready" && row.roundId === null);
}

/**
 * Recadrage manuel (design, décision 6) d'un import en « Échec », ou « Prêt à vérifier » sans
 * round : coins placés à la main (`corners_source = manual`), import remis « En attente » et
 * nouveau job `ocr-scorecard`, dans la même transaction. Un import en lecture ou déjà
 * enregistré en round n'est pas recadrable.
 */
export function recropImport(db: Db, id: number, corners: Corners, now: Date): RecropResult {
  return db.transaction((tx) => {
    const row = tx
      .select({ status: imports.status, roundId: imports.roundId })
      .from(imports)
      .where(eq(imports.id, id))
      .get();
    if (!row) return "not-found";
    if (!isRecroppable(row)) return "not-recroppable";
    // La nouvelle lecture remplace les corrections enregistrées.
    tx.update(imports)
      .set({ status: "queued", corners, cornersSource: "manual", correction: null })
      .where(eq(imports.id, id))
      .run();
    const payload: OcrScorecardPayload = { importId: id };
    enqueueJob(tx, OCR_SCORECARD_JOB, payload, now);
    return "queued";
  });
}

/** Raison du refus d'une suppression, traduite en HTTP par la route. */
export type DeleteImportRefusal = "not-found" | "reading" | "already-saved";

export type DeleteImportResult =
  | { result: "deleted"; photoPath: string }
  | { result: DeleteImportRefusal };

/**
 * Supprime un import pas encore enregistré en round, et son job `ocr-scorecard` encore en file,
 * dans une transaction (design, décision 1). Un import enregistré en round, puis un import en
 * lecture, sont refusés. Un job déjà réservé (`running`) reste : il échoue sur « Import
 * introuvable » sans effet (design, décision 2). Renvoie le chemin de la photo, à effacer après
 * le commit avec `removeUnreferencedPhoto`.
 */
export function deleteImport(db: Db, id: number): DeleteImportResult {
  return db.transaction((tx) => {
    const row = tx
      .select({ status: imports.status, roundId: imports.roundId, photoPath: imports.photoPath })
      .from(imports)
      .where(eq(imports.id, id))
      .get();
    if (!row) return { result: "not-found" };
    if (row.roundId !== null) return { result: "already-saved" };
    if (row.status === "reading") return { result: "reading" };
    tx.delete(jobs)
      .where(
        and(
          eq(jobs.type, OCR_SCORECARD_JOB),
          eq(jobs.status, "queued"),
          sql`json_extract(${jobs.payload}, '$.importId') = ${id}`,
        ),
      )
      .run();
    tx.delete(imports).where(eq(imports.id, id)).run();
    return { result: "deleted", photoPath: row.photoPath };
  });
}

export function getImportStatus(
  db: Db,
  id: number,
): { id: number; status: ImportStatus; label: string; draft: ScorecardDraft | null } | undefined {
  const row = db
    .select({ id: imports.id, status: imports.status, draft: imports.draft })
    .from(imports)
    .where(eq(imports.id, id))
    .get();
  if (!row) return undefined;
  return {
    id: row.id,
    status: row.status,
    label: importStatusLabel(row.status),
    draft: (row.draft as ScorecardDraft | null) ?? null,
  };
}

/**
 * Efface la photo `photoPath` (relative à `dataDir`) si plus aucun import ni round ne la porte
 * (design, décision 3). À appeler après le commit de la suppression, jamais dedans. Un `rm` qui
 * échoue est ignoré : au pire la photo reste orpheline.
 */
export async function removeUnreferencedPhoto(
  db: Db,
  dataDir: string,
  photoPath: string,
): Promise<void> {
  const carried =
    db.select({ id: imports.id }).from(imports).where(eq(imports.photoPath, photoPath)).get() ??
    db.select({ id: rounds.id }).from(rounds).where(eq(rounds.photoPath, photoPath)).get();
  if (carried) return;
  await rm(join(dataDir, photoPath), { force: true }).catch(() => undefined);
}
