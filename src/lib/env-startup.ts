import { getEnv } from "./env";

/** Valide l'environnement au démarrage ; arrête le processus avec un message clair sinon. */
export function assertEnvOrExit() {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
