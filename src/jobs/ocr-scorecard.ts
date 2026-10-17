import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports } from "@/db/schema";
import type { Corners } from "@/ocr/corners";
import { readScorecard } from "@/ocr/read-scorecard";
import type { ScorecardDraft } from "@/scorecard/draft";
import { type ImportStatus, OCR_SCORECARD_JOB, type OcrScorecardPayload } from "./imports";
import type { JobHandlers } from "./runner";

type ReadScorecard = (photo: Buffer, corners: Corners) => Promise<ScorecardDraft>;

function setImport(db: Db, id: number, values: { status: ImportStatus; draft?: ScorecardDraft }) {
  db.update(imports).set(values).where(eq(imports.id, id)).run();
}

/**
 * Gestionnaires du worker. `ocr-scorecard` lit la photo d'un import selon ses coins et
 * enregistre le brouillon : « Lecture en cours », puis « Prêt à vérifier », ou « Échec ».
 */
export function createJobHandlers(
  db: Db,
  dataDir: string,
  read: ReadScorecard = readScorecard,
): JobHandlers {
  return {
    [OCR_SCORECARD_JOB]: {
      async run(payload) {
        const { importId } = payload as OcrScorecardPayload;
        setImport(db, importId, { status: "reading" });
        const row = db.select().from(imports).where(eq(imports.id, importId)).get();
        if (!row) throw new Error(`Import introuvable : ${importId}`);
        const photo = await readFile(join(dataDir, row.photoPath));
        const draft = await read(photo, row.corners as Corners);
        setImport(db, importId, { status: "ready", draft });
      },
      onFailed(payload) {
        setImport(db, (payload as OcrScorecardPayload).importId, { status: "failed" });
      },
    },
  };
}
