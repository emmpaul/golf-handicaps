import packageJson from "../../package.json";

// Sha complet d'un commit git, tel que `github.sha` le donne.
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

/** Garde le commit passé au build s'il a la forme d'un sha complet, sinon `null`. */
export function parseCommit(raw: string | undefined): string | null {
  return raw !== undefined && COMMIT_PATTERN.test(raw) ? raw : null;
}

/** Page de la release GitHub du tag `v<version>`, dans le dépôt déclaré par `package.json`. */
export function releaseUrl(version: string): string {
  return `${packageJson.repository.url}/releases/tag/v${version}`;
}

/** Les 7 premiers caractères du sha, comme GitHub les affiche. */
export function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}

/** Version publiée de l'app, tenue par release-please dans `package.json`. */
export const APP_VERSION: string = packageJson.version;
// `process.env.GIT_COMMIT` est remplacé par sa valeur au build (`env` de `next.config.ts`).
export const APP_COMMIT: string | null = parseCommit(process.env.GIT_COMMIT);

/**
 * Réponse de `GET /api/version`. `no-store` : un proxy ne doit pas resservir l'ancienne version
 * juste après un déploiement.
 */
export function versionResponse(version: string, commit: string | null): Response {
  return Response.json({ version, commit }, { headers: { "Cache-Control": "no-store" } });
}
