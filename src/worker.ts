/**
 * Worker de tâches de fond (design, décision 4) : `node worker.js` dans l'image,
 * `tsx watch src/worker.ts` avec `pnpm dev`. Interroge la file `jobs` toutes les secondes.
 */
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { AiBudget } from "@/ai/budget";
import { ClaudeDraftCompleter } from "@/ai/completer";
import { ClaudeCornerLocator } from "@/ai/corner-locator";
import { openDatabase } from "@/db/client";
import { HEARTBEAT_FILE, writeHeartbeat } from "@/jobs/heartbeat";
import { type AiFallback, createJobHandlers } from "@/jobs/ocr-scorecard";
import { runNextJob } from "@/jobs/runner";
import { EXPECTED_SCHEMA_VERSION, isSchemaReady } from "@/jobs/schema-version";
import { startWorkerLoop } from "@/jobs/worker-loop";
import { getEnv } from "@/lib/env";
import { assertEnvOrExit } from "@/lib/env-startup";

const POLL_INTERVAL_MS = 1000;

assertEnvOrExit();
const { DATA_DIR, ANTHROPIC_API_KEY, AI_MONTHLY_BUDGET_USD, AI_BUDGET_TIME_ZONE } = getEnv();
const { db, sqlite } = openDatabase(join(DATA_DIR, "app.db"));
/**
 * IA du worker : complétion et cadrage sur le même client, sous le même budget. Sans clé, ni
 * l'une ni l'autre : le cadrage reste local et les cartes sont lues sans complétion.
 */
function createAiFallback(apiKey: string | null): AiFallback | null {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey });
  return {
    completer: new ClaudeDraftCompleter(client),
    locator: new ClaudeCornerLocator(client),
    budget: new AiBudget(db, AI_MONTHLY_BUDGET_USD, AI_BUDGET_TIME_ZONE),
  };
}

const ai = createAiFallback(ANTHROPIC_API_KEY);
const handlers = createJobHandlers(db, DATA_DIR, { ai });

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
