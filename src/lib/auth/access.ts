import { verifySessionToken } from "./session";

export type AccessDecision = "allow" | "redirect-login" | "unauthorized";

const PUBLIC_PATH = "/login";
// Fichiers d'installation de l'app, sans donnée du groupe : liste exacte, jamais un préfixe,
// pour qu'une future page `/icon-…` ne soit pas ouverte par mégarde.
const INSTALL_PATHS = new Set(["/manifest.webmanifest", "/apple-icon", "/icon/192", "/icon/512"]);
const READ_METHODS = new Set(["GET", "HEAD"]);

/**
 * Sans session valide : `/login` reste ouverte, le manifest et les icônes se lisent,
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
  if (INSTALL_PATHS.has(request.pathname) && READ_METHODS.has(request.method)) {
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
