import { APP_COMMIT, APP_VERSION, versionResponse } from "@/lib/version";

// Lisible sans session (`decideAccess`) ; ne lit pas la base.
export function GET() {
  return versionResponse(APP_VERSION, APP_COMMIT);
}
