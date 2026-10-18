import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import type { Db } from "@/db/client";
import { type importStatuses, imports } from "@/db/schema";
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
