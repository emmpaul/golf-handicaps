import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { AiBudget } from "@/ai/budget";
import { AiCompletionError, type AiUsage, type DraftCompleter } from "@/ai/completer";
import { mergeDraft } from "@/ai/merge";
import { AI_MODEL } from "@/ai/model";
import { callCost } from "@/ai/pricing";
import type { Db } from "@/db/client";
import { imports } from "@/db/schema";
import type { Corners } from "@/ocr/corners";
import { readScorecard, type ScorecardReading } from "@/ocr/read-scorecard";
import { checkDraft } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import { type ImportStatus, OCR_SCORECARD_JOB, type OcrScorecardPayload } from "./imports";
import type { JobHandlers } from "./runner";

type ReadScorecard = (photo: Buffer, corners: Corners) => Promise<ScorecardReading>;

/** Complétion IA du worker ; absente (`null`) sans `ANTHROPIC_API_KEY`. */
export type AiFallback = { completer: DraftCompleter; budget: AiBudget };

export type JobHandlerOptions = {
  read?: ReadScorecard;
  ai?: AiFallback | null;
  /** Horloge du budget mensuel. */
  now?: () => Date;
};

type ImportValues = {
  status: ImportStatus;
  draft?: ScorecardDraft;
  aiCells?: string[] | null;
  aiNote?: string | null;
};

/** Brouillon à enregistrer, cases venues de l'IA et message éventuel. */
type Completion = { draft: ScorecardDraft; aiCells: string[] | null; aiNote: string | null };

function setImport(db: Db, id: number, values: ImportValues) {
  db.update(imports).set(values).where(eq(imports.id, id)).run();
}

/** Un appel facturé, même sans carte exploitable, entre dans le cumul du mois. */
function recordUsage(budget: AiBudget, usage: AiUsage, now: Date) {
  const costMicroUsd = callCost(AI_MODEL, {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
  });
  budget.record({ ...usage, costMicroUsd }, now);
}

/**
 * Repli IA après la lecture locale (design, décision 2) : seulement si le brouillon a un
 * problème et qu'une clé est configurée, dans la limite du budget. Une erreur de l'IA est
 * attrapée ici : on garde le brouillon local, et le job ne consomme pas de tentative.
 */
async function complete(
  { draft, panel }: ScorecardReading,
  ai: AiFallback | null,
  now: Date,
): Promise<Completion> {
  const problems = checkDraft(draft);
  const local = { draft, aiCells: null, aiNote: null };
  if (problems.length === 0 || !ai) return local;
  if (!ai.budget.canSpend(now)) return { ...local, aiNote: "Budget IA du mois atteint" };
  try {
    const { card, usage } = await ai.completer.complete(panel);
    recordUsage(ai.budget, usage, now);
    return { ...mergeDraft(draft, card, problems), aiNote: null };
  } catch (error) {
    if (error instanceof AiCompletionError) recordUsage(ai.budget, error.usage, now);
    return { ...local, aiNote: "Complétion IA indisponible" };
  }
}

/**
 * Gestionnaires du worker. `ocr-scorecard` lit la photo d'un import selon ses coins et
 * enregistre le brouillon, complété par l'IA en repli : « Lecture en cours », puis
 * « Prêt à vérifier », ou « Échec ».
 */
export function createJobHandlers(
  db: Db,
  dataDir: string,
  { read = readScorecard, ai = null, now = () => new Date() }: JobHandlerOptions = {},
): JobHandlers {
  return {
    [OCR_SCORECARD_JOB]: {
      async run(payload) {
        const { importId } = payload as OcrScorecardPayload;
        setImport(db, importId, { status: "reading" });
        const row = db.select().from(imports).where(eq(imports.id, importId)).get();
        if (!row) throw new Error(`Import introuvable : ${importId}`);
        const photo = await readFile(join(dataDir, row.photoPath));
        const reading = await read(photo, row.corners as Corners);
        setImport(db, importId, { status: "ready", ...(await complete(reading, ai, now())) });
      },
      onFailed(payload) {
        setImport(db, (payload as OcrScorecardPayload).importId, { status: "failed" });
      },
    },
  };
}
