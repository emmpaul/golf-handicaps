import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { type Db, openDatabase } from "../../src/db/client";
import { prepareDatabase } from "../../src/db/prepare";
import { imports, rounds } from "../../src/db/schema";
import type { ImportStatus } from "../../src/jobs/imports";
import type { RoundForm } from "../../src/scorecard/checks";
import type { ScorecardDraft } from "../../src/scorecard/draft";
import { listPlayers } from "../../src/server/players/players";
import { saveRound } from "../../src/server/rounds/save";
import referenceCorners from "../fixtures/scorecards/gspro-img3064.corners.json";
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

/** Délai maximal d'attente de la fin du job que le worker exécute (lecture locale de la carte). */
const RUNNING_JOB_DEADLINE_MS = 30_000;
const RUNNING_JOB_POLL_MS = 100;

/**
 * Vide les tables si le worker n'exécute aucun job ; renvoie `false` sinon. Transaction
 * `IMMEDIATE` : le worker ne peut pas réserver un job entre la vérification et l'effacement.
 */
function wipeUnlessJobRunning(db: Db, sqlite: Connection["sqlite"]): boolean {
  prepareDatabase(db);
  return sqlite
    .transaction(() => {
      const running = sqlite.prepare("SELECT 1 FROM jobs WHERE status = 'running'").get();
      if (running) return false;
      for (const table of TABLES) sqlite.prepare(`DELETE FROM ${table}`).run();
      sqlite.prepare("DELETE FROM sqlite_sequence").run();
      return true;
    })
    .immediate();
}

/**
 * Remet la base du serveur e2e dans l'état d'un premier démarrage : aucun round, aucun
 * import, les joueurs initiaux Gab, Manu et Sean. Appelée avant chaque test.
 *
 * Attend d'abord la fin du job que le worker exécute peut-être pour le test précédent : sinon
 * il finit après l'effacement et écrit son état (« Prêt à vérifier ») sur l'import du test
 * suivant, qui reprend le même id.
 */
export async function resetData(): Promise<Record<"Gab" | "Manu" | "Sean", number>> {
  const deadline = Date.now() + RUNNING_JOB_DEADLINE_MS;
  while (!withDb(wipeUnlessJobRunning)) {
    if (Date.now() > deadline) {
      throw new Error(`Job du worker toujours en cours après ${RUNNING_JOB_DEADLINE_MS} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, RUNNING_JOB_POLL_MS));
  }
  return withDb((db) => {
    prepareDatabase(db);
    return Object.fromEntries(listPlayers(db).map(({ id, name }) => [name, id])) as Record<
      "Gab" | "Manu" | "Sean",
      number
    >;
  });
}

/**
 * Enregistre un round directement en base (mise en place d'un test), depuis l'import `importId`
 * s'il est donné : le round reprend sa photo et l'import est relié au round.
 */
export function seedRound(form: RoundForm, options: { importId?: number } = {}): number {
  return withDb((db) => saveRound(db, form, options));
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
  "status" | "corners" | "cornersSource" | "draft" | "aiCells" | "aiNote" | "correction" | "roundId"
>;

/**
 * Provenance d'un import lu : cases complétées par l'IA, message affiché, provenance du cadrage
 * (`cornersSource`) et round déjà enregistré (`roundId`).
 */
type SeededReading = Pick<SeededImport, "aiCells" | "aiNote" | "cornersSource" | "roundId">;

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
 * Import « Prêt à vérifier » de la photo de référence, cadré sur ses coins mesurés à la main,
 * avec la lecture de la tâche 6.7 (ou le brouillon `draft`), et éventuellement une complétion
 * par l'IA, une provenance du cadrage ou un round (`reading`).
 */
export const seedReadyImport = (
  draft: ScorecardDraft = referenceDraft,
  reading: SeededReading = {},
) => seedImport({ status: "ready", corners: referenceCorners, draft, ...reading });

/** Coins par défaut de l'éditeur (10 % et 90 %), à côté du panneau de la photo de référence. */
export const DEFAULT_CORNERS = {
  topLeft: { x: 0.1, y: 0.1 },
  topRight: { x: 0.9, y: 0.1 },
  bottomRight: { x: 0.9, y: 0.9 },
  bottomLeft: { x: 0.1, y: 0.9 },
};

/**
 * Import « Échec » de la photo de référence, cadré à côté du panneau (coins par défaut de
 * l'éditeur) : la lecture a échoué deux fois. `correction` simule une correction enregistrée.
 */
export const seedFailedImport = (correction: SeededImport["correction"] = null) =>
  seedImport({ correction, status: "failed", corners: DEFAULT_CORNERS, draft: null });

/** Import « Échec » sans coins : aucun cadrage trouvé sur la photo (« Panneau introuvable »). */
export const seedPanelNotFoundImport = () =>
  seedImport({ status: "failed", corners: null, draft: null });

/**
 * Import « En attente » ou « Lecture en cours » sans job : le worker ne le touche pas, il
 * garde son état jusqu'à `setImportStatus`.
 */
export const seedQueuedImport = (status: "queued" | "reading") =>
  seedImport({ status, corners: DEFAULT_CORNERS, draft: null });

/** Change la date de création d'un import en base (date affichée dans la liste). */
export function setImportCreatedAt(id: number, createdAt: Date) {
  withDb((db) => db.update(imports).set({ createdAt }).where(eq(imports.id, id)).run());
}

/** Coins enregistrés d'un import et leur provenance. */
export function importCorners(id: number) {
  return withDb((db) =>
    db
      .select({ corners: imports.corners, cornersSource: imports.cornersSource })
      .from(imports)
      .where(eq(imports.id, id))
      .get(),
  );
}

/** Change l'état d'un import en base, comme le ferait le worker. */
export function setImportStatus(id: number, status: ImportStatus) {
  withDb((db) => db.update(imports).set({ status }).where(eq(imports.id, id)).run());
}
