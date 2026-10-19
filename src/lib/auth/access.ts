import { verifySessionToken } from "./session";

export type AccessDecision = "allow" | "redirect-login" | "unauthorized";

const PUBLIC_PATH = "/login";
// Chemins lisibles sans session, sans donnée du groupe : fichiers d'installation de l'app et
// route de version. Liste exacte, jamais un préfixe, pour qu'une future page `/icon-…` ou une
// route `/api/version/…` ne soit pas ouverte par mégarde.
const PUBLIC_READ_PATHS = new Set([
  "/manifest.webmanifest",
  "/apple-icon",
  "/icon/192",
  "/icon/512",
  "/api/version",
]);
const READ_METHODS = new Set(["GET", "HEAD"]);

/**
 * Sans session valide : `/login` reste ouverte, le manifest, les icônes et la version se lisent,
 * une page lue redirige vers `/login`,
 * et toute API ou écriture (server action, route handler) reçoit 401.
 */
export function decideAccess(request: {
  method: string;
  pathname: string;
  token: string | undefined;
  secret: string;
  now: number;
}): AccessDecision {
  if (request.pathname === PUBLIC_PATH) {
    return "allow";
  }
  if (PUBLIC_READ_PATHS.has(request.pathname) && READ_METHODS.has(request.method)) {
    return "allow";
  }
  if (verifySessionToken(request.token, request.secret, request.now)) {
    return "allow";
  }
  if (request.pathname.startsWith("/api/") || !READ_METHODS.has(request.method)) {
    return "unauthorized";
  }
  return "redirect-login";
}
