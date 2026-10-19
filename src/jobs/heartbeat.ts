import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Battement du worker (design, décision 3). Dans le `/tmp` du conteneur, pas dans `/data` : un
 * nouveau conteneur ne voit jamais le battement de l'ancien, et le web n'en écrit pas. Le
 * healthcheck de `docker-compose.yml` lit ce chemin en dur.
 */
export const HEARTBEAT_FILE = join(tmpdir(), "golf-worker-heartbeat");

/** Écrit l'instant `now` en millisecondes, au début de chaque tour de boucle. */
export function writeHeartbeat(file: string, now: Date): void {
  writeFileSync(file, String(now.getTime()));
}

/** `false` si le fichier manque, ne contient pas un nombre ou date de `maxAgeMs` ou plus. */
export function isHeartbeatFresh(file: string, now: Date, maxAgeMs: number): boolean {
  let beat: number;
  try {
    beat = Number(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  return now.getTime() - beat < maxAgeMs;
}
