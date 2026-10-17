import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";
import { migrateDatabase, openDatabase } from "@/db/client";
import type { RoundForm } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import { listPlayers } from "@/server/players/players";
import { seedInitialPlayers } from "@/server/players/seed";
import referenceDraft from "./fixtures/scorecards/gspro-img3064.draft.json";

/** Carte de référence IMG_3064 : Bethpage Black, tees Red (par 71). */
export const referenceCard = {
  pars: [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 4, 4, 5, 3, 4, 4, 3, 4],
  strokeIndexes: [8, 16, 18, 2, 4, 10, 6, 14, 12, 9, 11, 7, 3, 17, 1, 5, 13, 15],
  scores: {
    gab: [5, 5, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 4, 3, 4, 5, 3, 3],
    manu: [7, 5, 3, 7, 6, 5, 5, 3, 5, 3, 6, 5, 7, 4, 5, 4, 3, 5],
  },
} as const;

/**
 * Formulaire de round pré-rempli avec la lecture de la carte de référence (tâche 6.7),
 * lignes GAB puis MANU associées à `playerIds`. Copie neuve à chaque appel, modifiable.
 */
export function referenceForm(playerIds: readonly (number | null)[] = [1, 2]): RoundForm {
  const draft: ScorecardDraft = structuredClone(referenceDraft);
  return {
    ...draft,
    players: draft.players.map((row, i) => ({ ...row, playerId: playerIds[i] ?? null })),
  };
}

/** Ligne de 18 scores avec ses totaux OUT, IN et TOT justes. */
function scoreRow(holes: readonly number[]) {
  const add = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
  const out = add(holes.slice(0, 9));
  const back = add(holes.slice(9));
  return { holes: [...holes], out, in: back, total: out + back };
}

/**
 * Scores sur la carte de référence (par 71) pour un différentiel de `over` coups :
 * un coup de plus (ou de moins si négatif) par trou à partir du trou 1, sans dépasser par + 2.
 */
export function strokesOverPar(over: number): number[] {
  const step = Math.sign(over);
  return referenceCard.pars.map(
    (par, hole) =>
      par + step * (Math.floor(Math.abs(over) / 18) + (hole < Math.abs(over) % 18 ? 1 : 0)),
  );
}

/** Round sur la carte de référence, joué le `playedOn`, une ligne par joueur. */
export function roundForm(
  playedOn: string,
  lines: readonly { playerId: number; strokes: readonly number[] }[],
  course: { courseName?: string; tees?: string } = {},
): RoundForm {
  return {
    ...referenceForm(),
    ...course,
    playedOn,
    players: lines.map(({ playerId, strokes }) => ({
      name: null,
      playerId,
      scores: scoreRow(strokes),
    })),
  };
}

/** Base temporaire avec les 3 joueurs initiaux et leurs ids par nom. */
export function createSeededTestDb() {
  const testDb = createTestDb();
  seedInitialPlayers(testDb.db);
  const ids = Object.fromEntries(listPlayers(testDb.db).map((p) => [p.name, p.id])) as Record<
    "Gab" | "Manu" | "Sean",
    number
  >;
  return { ...testDb, ids };
}

/** Base SQLite temporaire, migrée, dans un dossier jetable. Appeler `cleanup()` après le test. */
export type TestDb = ReturnType<typeof createTestDb>;

export function createTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "golf-db-"));
  const { db, sqlite } = openDatabase(join(dir, "app.db"));
  migrateDatabase(db);
  return {
    db,
    sqlite,
    /** Dossier jetable de la base, utilisable comme `DATA_DIR`. */
    dir,
    file: join(dir, "app.db"),
    cleanup() {
      sqlite.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export type SeededTestDb = ReturnType<typeof createSeededTestDb>;

/**
 * Base seedée neuve pour chaque test du fichier (créée avant, supprimée après).
 * L'objet rendu est stable : ses propriétés sont remplacées avant chaque test.
 */
export function seededTestDbPerTest(): SeededTestDb {
  const current = {} as SeededTestDb;
  beforeEach(() => {
    Object.assign(current, createSeededTestDb());
  });
  afterEach(() => {
    current.cleanup();
  });
  return current;
}
