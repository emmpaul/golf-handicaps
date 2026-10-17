/**
 * Worker de tâches de fond (design, décision 4) : `node worker.js` dans l'image,
 * `tsx watch src/worker.ts` avec `pnpm dev`. Interroge la file `jobs` toutes les secondes.
 */
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { AiBudget } from "@/ai/budget";
import { ClaudeDraftCompleter } from "@/ai/completer";
import { openDatabase } from "@/db/client";
import { createJobHandlers } from "@/jobs/ocr-scorecard";
import { runNextJob } from "@/jobs/runner";
import { EXPECTED_SCHEMA_VERSION, isSchemaReady } from "@/jobs/schema-version";
import { startWorkerLoop } from "@/jobs/worker-loop";
import { getEnv } from "@/lib/env";
import { assertEnvOrExit } from "@/lib/env-startup";

const POLL_INTERVAL_MS = 1000;

assertEnvOrExit();
const { DATA_DIR, ANTHROPIC_API_KEY, AI_MONTHLY_BUDGET_USD } = getEnv();
const { db, sqlite } = openDatabase(join(DATA_DIR, "app.db"));
// Sans clé, pas de complétion IA : le worker lit les cartes comme avant.
const ai = ANTHROPIC_API_KEY
  ? {
      completer: new ClaudeDraftCompleter(new Anthropic({ apiKey: ANTHROPIC_API_KEY })),
      budget: new AiBudget(db, AI_MONTHLY_BUDGET_USD),
    }
  : null;
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

const loop = startWorkerLoop({
  intervalMs: POLL_INTERVAL_MS,
  runOnce: async () => checkSchema() && runNextJob(db, handlers, new Date()),
  onError: (error) => console.error("[worker]", error),
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
