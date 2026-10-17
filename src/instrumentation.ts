/**
 * Le serveur web refuse de démarrer si une variable obligatoire manque, puis applique les
 * migrations et crée les joueurs initiaux (design, décision 2). Le worker attend ces migrations.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvOrExit } = await import("./lib/env-startup");
    assertEnvOrExit();
    const { getDb } = await import("./db/instance");
    const { prepareDatabase } = await import("./db/prepare");
    prepareDatabase(getDb());
  }
}
