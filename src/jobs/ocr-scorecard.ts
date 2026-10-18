import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { AiCompletionError } from "@/ai/claude-call";
import { mergeDraft } from "@/ai/merge";
import { MAX_CALL_COST } from "@/ai/pricing";
import type { Db } from "@/db/client";
import { type cornersSources, imports } from "@/db/schema";
import type { Corners } from "@/ocr/corners";
import type { GrayImage } from "@/ocr/image";
import { readScorecard, readScorecardPanel, type ScorecardReading } from "@/ocr/read-scorecard";
import { checkDraft } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import { type ImportStatus, OCR_SCORECARD_JOB, type OcrScorecardPayload } from "./imports";
import { type AiFallback, locatePanel, recordUsage } from "./locate-panel";
import type { JobHandlers } from "./runner";

export type { AiFallback } from "./locate-panel";

type ReadScorecard = (photo: Buffer, corners: Corners) => Promise<ScorecardReading>;

export type JobHandlerOptions = {
  /** Lecture d'un import qui a ses coins (recadrage manuel, ou import antérieur à la détection). */
  read?: ReadScorecard;
  /** Cadrage d'un import sans coins. */
  locate?: typeof locatePanel;
  /** Lecture du panneau redressé accepté par le cadrage. */
  readPanel?: (panel: GrayImage) => Promise<ScorecardDraft>;
  ai?: AiFallback | null;
  /** Horloge du budget mensuel. */
  now?: () => Date;
};

type ImportValues = {
  status: ImportStatus;
  draft?: ScorecardDraft;
  aiCells?: string[] | null;
  aiNote?: string | null;
  corners?: Corners;
  cornersSource?: (typeof cornersSources)[number];
};

/** Brouillon à enregistrer, cases venues de l'IA et message éventuel. */
type Completion = { draft: ScorecardDraft; aiCells: string[] | null; aiNote: string | null };

function setImport(db: Db, id: number, values: ImportValues) {
  db.update(imports).set(values).where(eq(imports.id, id)).run();
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
  if (!ai.budget.canSpend(now, MAX_CALL_COST))
    return { ...local, aiNote: "Budget IA du mois atteint" };
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
 * Gestionnaires du worker (design, décision 5). `ocr-scorecard` lit la photo d'un import selon
 * ses coins, tels quels s'il en a, sinon selon le cadrage trouvé (détection locale, puis IA), et
 * enregistre le brouillon, complété par l'IA en repli : « Lecture en cours », puis « Prêt à
 * vérifier », ou « Échec ». Sans cadrage trouvé, l'import passe en « Échec » sans coins
 * (« Panneau introuvable ») et le job se termine sans lever : une relance donnerait le même
 * résultat, et un second appel IA coûterait pour rien.
 */
export function createJobHandlers(
  db: Db,
  dataDir: string,
  {
    read = readScorecard,
    locate = locatePanel,
    readPanel = readScorecardPanel,
    ai = null,
    now = () => new Date(),
  }: JobHandlerOptions = {},
): JobHandlers {
  /** Lecture selon les coins de l'import, ou selon le cadrage trouvé ; `null` sans cadrage. */
  async function readImport(
    importId: number,
    photo: Buffer,
    corners: Corners | null,
  ): Promise<ScorecardReading | null> {
    if (corners) return read(photo, corners);
    const located = await locate(photo, ai, now());
    if (!located) return null;
    setImport(db, importId, {
      status: "reading",
      corners: located.corners,
      cornersSource: located.source,
    });
    return { draft: await readPanel(located.panel), panel: located.panel };
  }

  return {
    [OCR_SCORECARD_JOB]: {
      async run(payload) {
        const { importId } = payload as OcrScorecardPayload;
        setImport(db, importId, { status: "reading" });
        const row = db.select().from(imports).where(eq(imports.id, importId)).get();
        if (!row) throw new Error(`Import introuvable : ${importId}`);
        const photo = await readFile(join(dataDir, row.photoPath));
        const reading = await readImport(importId, photo, row.corners as Corners | null);
        if (!reading) {
          setImport(db, importId, { status: "failed" });
          return;
        }
        setImport(db, importId, { status: "ready", ...(await complete(reading, ai, now())) });
      },
      onFailed(payload) {
        setImport(db, (payload as OcrScorecardPayload).importId, { status: "failed" });
      },
    },
  };
}
