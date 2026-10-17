import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Db, openDatabase } from "../../src/db/client";
import { prepareDatabase } from "../../src/db/prepare";
import { imports, rounds } from "../../src/db/schema";
import type { RoundForm } from "../../src/scorecard/checks";
import type { ScorecardDraft } from "../../src/scorecard/draft";
import { listPlayers } from "../../src/server/players/players";
import { saveRound } from "../../src/server/rounds/save";
import referenceDraft from "../fixtures/scorecards/gspro-img3064.draft.json";

/** Tables vidées entre deux tests, enfants avant parents. */
const TABLES = [
  "jobs",
  "imports",
  "player_round_stats",
  "scores",
  "round_players",
  "round_holes",
  "rounds",
  "player_aliases",
  "players",
];

type Connection = ReturnType<typeof openDatabase>;

function withDb<T>(use: (db: Db, sqlite: Connection["sqlite"]) => T): T {
  const dataDir = process.env.E2E_DATA_DIR;
  if (!dataDir) throw new Error("E2E_DATA_DIR manquant : lancer les tests avec `pnpm e2e`");
  const { db, sqlite } = openDatabase(join(dataDir, "app.db"));
  try {
    return use(db, sqlite);
  } finally {
    sqlite.close();
  }
}

/**
 * Remet la base du serveur e2e dans l'état d'un premier démarrage : aucun round, aucun
 * import, les joueurs initiaux Gab, Manu et Sean. Appelée avant chaque test.
 */
export function resetData(): Record<"Gab" | "Manu" | "Sean", number> {
  return withDb((db, sqlite) => {
    prepareDatabase(db);
    sqlite.transaction(() => {
      for (const table of TABLES) sqlite.prepare(`DELETE FROM ${table}`).run();
      sqlite.prepare("DELETE FROM sqlite_sequence").run();
    })();
    prepareDatabase(db);
    return Object.fromEntries(listPlayers(db).map(({ id, name }) => [name, id])) as Record<
      "Gab" | "Manu" | "Sean",
      number
    >;
  });
}

/** Enregistre un round directement en base (mise en place d'un test). */
export function seedRound(form: RoundForm): number {
  return withDb((db) => saveRound(db, form));
}

/** Dates de jeu (`rounds.played_on`) des rounds en base, par id croissant. */
export function roundDates(): string[] {
  return withDb((db) =>
    db.select({ playedOn: rounds.playedOn }).from(rounds).orderBy(rounds.id).all(),
  ).map(({ playedOn }) => playedOn);
}

/**
 * Round de la carte de référence (Bethpage Black, tees Red, par 71) : Gab 72 et Manu 88,
 * joué le `playedOn`. Valeurs de la lecture de IMG_3064 (tâche 6.7).
 */
export function referenceRound(
  ids: { Gab: number; Manu: number },
  overrides: Partial<RoundForm> = {},
): RoundForm {
  const draft = structuredClone(referenceDraft) as ScorecardDraft;
  return {
    ...draft,
    courseName: "Bethpage Black",
    players: [
      { ...draft.players[0], playerId: ids.Gab },
      { ...draft.players[1], playerId: ids.Manu },
    ],
    ...overrides,
  };
}

const REFERENCE_PARS = referenceDraft.par.holes;

/**
 * Scores sur la carte de référence (par 71) pour `over` coups au-dessus du par (0 à 36) :
 * un coup de plus sur chacun des `over` premiers trous, deux au-delà de 18.
 */
export function scoresOverPar(over: number) {
  const holes = REFERENCE_PARS.map(
    (par, hole) => par + (hole < over ? 1 : 0) + (hole < over - 18 ? 1 : 0),
  );
  const out = holes.slice(0, 9).reduce((total, value) => total + value, 0);
  return { holes, out, in: 71 + over - out, total: 71 + over };
}

type SeededImport = Pick<
  typeof imports.$inferInsert,
  "status" | "corners" | "draft" | "aiCells" | "aiNote" | "correction"
>;

/** Provenance IA d'un import : cases complétées par l'IA et message affiché. */
type SeededAi = Pick<SeededImport, "aiCells" | "aiNote">;

/** Import de la photo de référence dans l'état donné, sans passer par le worker. Renvoie son id. */
function seedImport(values: SeededImport): number {
  const dataDir = process.env.E2E_DATA_DIR ?? "";
  mkdirSync(join(dataDir, "uploads"), { recursive: true });
  copyFileSync(
    join(__dirname, "..", "fixtures", "scorecards", "gspro-img3064.jpg"),
    join(dataDir, "uploads", "reference.jpg"),
  );
  return withDb((db) =>
    db
      .insert(imports)
      .values({ photoPath: "uploads/reference.jpg", ...values })
      .returning({ id: imports.id })
      .get(),
  ).id;
}

/**
 * Import « Prêt à vérifier » de la photo de référence, avec la lecture de la tâche 6.7
 * (ou le brouillon `draft`), et éventuellement une complétion par l'IA (`ai`).
 */
export const seedReadyImport = (draft: ScorecardDraft = referenceDraft, ai: SeededAi = {}) =>
  seedImport({ status: "ready", corners: {}, draft, ...ai });

/**
 * Import « Échec » de la photo de référence, cadré à côté du panneau (coins par défaut de
 * l'éditeur) : la lecture a échoué deux fois. `correction` simule une correction enregistrée.
 */
export const seedFailedImport = (correction: SeededImport["correction"] = null) =>
  seedImport({
    correction,
    status: "failed",
    corners: {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.9, y: 0.9 },
      bottomLeft: { x: 0.1, y: 0.9 },
    },
    draft: null,
  });
