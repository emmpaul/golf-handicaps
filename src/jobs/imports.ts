import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
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
 * Enregistre la photo sous `DATA_DIR/uploads/<uuid>.jpg`, puis crée l'import et son job
 * `ocr-scorecard` dans la même transaction (design, décision 5.2).
 */
export function createImport(
  db: Db,
  dataDir: string,
  upload: { photo: Buffer; corners: Corners },
  now: Date,
): { id: number; photoPath: string } {
  const photoPath = `uploads/${randomUUID()}.jpg`;
  const file = join(dataDir, photoPath);
  mkdirSync(join(dataDir, "uploads"), { recursive: true });
  writeFileSync(file, upload.photo);
  try {
    return db.transaction((tx) => {
      const { id } = tx
        .insert(imports)
        .values({ photoPath, corners: upload.corners, createdAt: now })
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

export type RecropResult = "queued" | "not-found" | "not-failed";

/**
 * Recadrage d'un import en « Échec » (spec « Échec de la lecture ») : nouveaux coins, import
 * remis « En attente » et nouveau job `ocr-scorecard`, dans la même transaction.
 */
export function recropImport(db: Db, id: number, corners: Corners, now: Date): RecropResult {
  return db.transaction((tx) => {
    const row = tx.select({ status: imports.status }).from(imports).where(eq(imports.id, id)).get();
    if (!row) return "not-found";
    if (row.status !== "failed") return "not-failed";
    // La nouvelle lecture remplace les corrections enregistrées.
    tx.update(imports)
      .set({ status: "queued", corners, correction: null })
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
