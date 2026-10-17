import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  type EditorState,
  emptyEditorState,
  readEditorState,
  restoreEditorState,
} from "@/components/round-editor/form-state";
import type { Db } from "@/db/client";
import { imports } from "@/db/schema";
import type { RoundForm } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import { savedCorrectionSchema } from "@/scorecard/form-schema";
import { findPlayerForName } from "@/server/players/aliases";
import { listPlayers } from "@/server/players/players";

export function getImport(db: Db, id: number) {
  return db.select().from(imports).where(eq(imports.id, id)).get();
}

/**
 * Brouillon lu, chaque ligne associée au joueur dont le nom ou un alias correspond
 * (spec `players`) ; sans correspondance, la ligne attend le choix de l'utilisateur.
 */
export function formFromDraft(db: Db, draft: ScorecardDraft): RoundForm {
  return {
    ...draft,
    players: draft.players.map((row) => ({
      ...row,
      playerId: row.name ? (findPlayerForName(db, row.name)?.playerId ?? null) : null,
    })),
  };
}

type ImportRow = NonNullable<ReturnType<typeof getImport>>;

/**
 * État d'ouverture de l'écran de correction (spec « Reprise de la correction enregistrée ») :
 * la correction enregistrée si elle est lisible, sinon la lecture (date manquante : `today`),
 * sinon l'écran vide daté de `today`.
 */
export function initialEditorState(db: Db, row: ImportRow, today: string): EditorState {
  const saved = savedCorrectionSchema.safeParse(row.correction);
  if (saved.success) return restoreEditorState(saved.data, listPlayers(db));
  const draft = row.draft as ScorecardDraft | null;
  if (!draft) return emptyEditorState(today);
  return readEditorState(
    { ...formFromDraft(db, draft), playedOn: draft.playedOn ?? today },
    true,
    row.aiCells ?? [],
  );
}

export type SaveCorrectionResult = "ok" | "invalid" | "not-found" | "already-saved" | "reading";

/**
 * Enregistre la correction d'un import « Prêt à vérifier » ou en « Échec » sans round
 * (spec « Correction refusée hors vérification »). Un seul UPDATE conditionnel : SQLite
 * sérialise les écritures, donc une correction ne passe jamais après l'enregistrement du
 * round. S'il ne touche aucune ligne, une lecture dit pourquoi. `draft` reste intact.
 */
export function saveCorrection(db: Db, id: string, raw: unknown): SaveCorrectionResult {
  if (!/^\d+$/.test(id)) return "not-found";
  const parsed = savedCorrectionSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  const importId = Number(id);
  const { changes } = db
    .update(imports)
    .set({ correction: parsed.data })
    .where(
      and(
        eq(imports.id, importId),
        isNull(imports.roundId),
        inArray(imports.status, ["ready", "failed"]),
      ),
    )
    .run();
  if (changes > 0) return "ok";
  const row = getImport(db, importId);
  if (!row) return "not-found";
  return row.roundId !== null ? "already-saved" : "reading";
}
