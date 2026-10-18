/**
 * Le serveur web refuse de démarrer si une variable obligatoire manque, puis applique les
 * migrations et crée les joueurs initiaux (design, décision 2). Le worker attend ces migrations.
 * Les photos encore en JPEG sont ensuite converties en WebP en arrière-plan, sans retarder le
 * démarrage (design WebP, décision 4).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvOrExit } = await import("./lib/env-startup");
    assertEnvOrExit();
    const { getDb } = await import("./db/instance");
    const { prepareDatabase } = await import("./db/prepare");
    prepareDatabase(getDb());
    const { getEnv } = await import("./lib/env");
    const { convertStoredPhotos } = await import("./jobs/convert-photos");
    convertStoredPhotos(getDb(), getEnv().DATA_DIR).then(
      ({ converted, failed }) =>
        console.info(`Photos converties en WebP : ${converted}, échecs : ${failed.length}`),
      (error) => console.error("Conversion des photos en WebP interrompue :", error),
    );
  }
}
