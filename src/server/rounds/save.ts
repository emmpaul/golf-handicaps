import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { imports, roundHoles, roundPlayers, rounds, scores } from "@/db/schema";
import {
  checkRoundForm,
  type Problem,
  problemCountLabel,
  type RoundForm,
} from "@/scorecard/checks";
import type { DraftValue } from "@/scorecard/draft";
import { recomputeStats, type Tx } from "./stats";

/** Refus d'enregistrer une carte qui ne passe pas les contrôles de cohérence (tâche 5.1). */
export class RoundCheckError extends Error {
  constructor(readonly problems: Problem[]) {
    super(problemCountLabel(problems.length));
    this.name = "RoundCheckError";
  }
}

export function assertCoherent(form: RoundForm) {
  const problems = checkRoundForm(form);
  if (problems.length > 0) throw new RoundCheckError(problems);
}

// Après `assertCoherent`, aucune case obligatoire n'est vide.
const filled = (value: DraftValue) => value as number;
const filledText = (value: string | null) => (value ?? "").trim();

export function roundColumns(form: RoundForm) {
  return {
    courseName: filledText(form.courseName),
    tees: filledText(form.tees),
    playedOn: filledText(form.playedOn),
  };
}

export const formPlayerIds = (form: RoundForm) => form.players.map((row) => filled(row.playerId));

/** Écrit les trous, les joueurs et les scores d'un round (sans ses lignes précédentes). */
export function writeRoundCard(tx: Tx, roundId: number, form: RoundForm) {
  tx.insert(roundHoles)
    .values(
      form.par.holes.map((par, i) => ({
        roundId,
        hole: i + 1,
        par: filled(par),
        strokeIndex: filled(form.strokeIndex[i]),
        distance: form.distance.holes[i],
      })),
    )
    .run();
  form.players.forEach((row, position) => {
    const playerId = filled(row.playerId);
    tx.insert(roundPlayers).values({ roundId, playerId, position }).run();
    tx.insert(scores)
      .values(
        row.scores.holes.map((strokes, i) => ({
          roundId,
          playerId,
          hole: i + 1,
          strokes: filled(strokes),
        })),
      )
      .run();
  });
}

export class ImportNotFoundError extends Error {
  constructor() {
    super("Import introuvable");
    this.name = "ImportNotFoundError";
  }
}

function importPhoto(tx: Tx, importId: number) {
  const row = tx
    .select({ photoPath: imports.photoPath })
    .from(imports)
    .where(eq(imports.id, importId))
    .get();
  if (!row) throw new ImportNotFoundError();
  return row.photoPath;
}

/**
 * Enregistre un round après avoir rejoué les contrôles de cohérence, puis recalcule les
 * stats des joueurs du round, le tout dans une seule transaction (design, décision 3).
 * Depuis un import, le round garde sa photo et l'import est relié au round créé.
 */
export function saveRound(db: Db, form: RoundForm, options: { importId?: number } = {}): number {
  assertCoherent(form);
  return db.transaction((tx) => {
    const photoPath = options.importId === undefined ? null : importPhoto(tx, options.importId);
    const { id } = tx
      .insert(rounds)
      .values({ ...roundColumns(form), photoPath })
      .returning({ id: rounds.id })
      .get();
    if (options.importId !== undefined) {
      tx.update(imports).set({ roundId: id }).where(eq(imports.id, options.importId)).run();
    }
    writeRoundCard(tx, id, form);
    recomputeStats(tx, formPlayerIds(form));
    return id;
  });
}
