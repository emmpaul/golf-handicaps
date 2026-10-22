/**
 * Worker de tâches de fond (design, décision 4) : `node worker.js` dans l'image,
 * `tsx watch src/worker.ts` avec `pnpm dev`. Interroge la file `jobs` toutes les secondes.
 */
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { AiBudget } from "@/ai/budget";
import { ClaudeDraftCompleter } from "@/ai/completer";
import { ClaudeCornerLocator } from "@/ai/corner-locator";
import { ClaudeRatingReader } from "@/ai/rating-reader";
import { openDatabase } from "@/db/client";
import type { RatingAi } from "@/jobs/course-rating";
import { HEARTBEAT_FILE, writeHeartbeat } from "@/jobs/heartbeat";
import { type AiFallback, createJobHandlers } from "@/jobs/ocr-scorecard";
import { runNextJob } from "@/jobs/runner";
import { EXPECTED_SCHEMA_VERSION, isSchemaReady } from "@/jobs/schema-version";
import { startWorkerLoop } from "@/jobs/worker-loop";
import { getEnv } from "@/lib/env";
import { assertEnvOrExit } from "@/lib/env-startup";
import { SgtClient } from "@/server/courses/sgt";

const POLL_INTERVAL_MS = 1000;

assertEnvOrExit();
const { DATA_DIR, ANTHROPIC_API_KEY, AI_MONTHLY_BUDGET_USD, AI_BUDGET_TIME_ZONE, SGT_LOOKUP } =
  getEnv();
const { db, sqlite } = openDatabase(join(DATA_DIR, "app.db"));
/**
 * IA du worker : complétion, cadrage et lecture des cartes SGT sur le même client, sous le
 * même budget. Sans clé, aucune : le cadrage reste local, les cartes sont lues sans
 * complétion et la rating se saisit à la main.
 */
function createAi(apiKey: string | null): { fallback: AiFallback; rating: RatingAi } | null {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  const budget = new AiBudget(db, AI_MONTHLY_BUDGET_USD, AI_BUDGET_TIME_ZONE);
  return {
    fallback: {
      completer: new ClaudeDraftCompleter(client),
      locator: new ClaudeCornerLocator(client),
      budget,
    },
    rating: { reader: new ClaudeRatingReader(client), budget },
  };
}

const ai = createAi(ANTHROPIC_API_KEY);
// Un seul client SGT pour tous les jobs : la liste n'est téléchargée qu'une fois par 24 h.
const handlers = createJobHandlers(db, DATA_DIR, {
  ai: ai?.fallback ?? null,
  courseRating: { sgt: new SgtClient(), ai: ai?.rating ?? null, lookup: SGT_LOOKUP === "on" },
});

let schemaReady = false;
let waitingLogged = false;

/** Le web applique les migrations au démarrage ; le worker attend la version attendue. */
function checkSchema(): boolean {
  schemaReady ||= isSchemaReady(sqlite, EXPECTED_SCHEMA_VERSION);
  if (!schemaReady && !waitingLogged) {
    console.info("[worker] En attente des migrations de la base…");
    waitingLogged = true;
  }
  return schemaReady;
}

const logError = (error: unknown) => console.error("[worker]", error);

/**
 * Battement au début de chaque tour, avant l'attente des migrations : file vide, attente ou job
 * fini, le healthcheck voit le worker vivant. Un échec d'écriture est journalisé sans bloquer la
 * file ; le battement vieillit et le healthcheck vire au rouge.
 */
function beat() {
  try {
    writeHeartbeat(HEARTBEAT_FILE, new Date());
  } catch (error) {
    logError(error);
  }
}

const loop = startWorkerLoop({
  intervalMs: POLL_INTERVAL_MS,
  runOnce: async () => {
    beat();
    return checkSchema() && runNextJob(db, handlers, new Date());
  },
  onError: logError,
});
console.info(`[worker] Démarré, base ${join(DATA_DIR, "app.db")}`);

async function shutdown(signal: string) {
  console.info(`[worker] ${signal} reçu, arrêt après le job en cours`);
  await loop.stop();
  sqlite.close();
  process.exit(0);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void shutdown(signal));
}
