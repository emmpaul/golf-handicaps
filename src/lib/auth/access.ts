import { verifySessionToken } from "./session";

export type AccessDecision = "allow" | "redirect-login" | "unauthorized";

const PUBLIC_PATH = "/login";
const READ_METHODS = new Set(["GET", "HEAD"]);

/**
 * Sans session valide : `/login` reste ouverte, une page lue redirige vers `/login`,
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
  if (verifySessionToken(request.token, request.secret, request.now)) {
    return "allow";
  }
  if (request.pathname.startsWith("/api/") || !READ_METHODS.has(request.method)) {
    return "unauthorized";
  }
  return "redirect-login";
}
