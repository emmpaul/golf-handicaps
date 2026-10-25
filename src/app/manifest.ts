import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "./brand-colors";

/** Manifest servi à `/manifest.webmanifest`, ouvert sans session (voir `decideAccess`). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Handicaps golf",
    short_name: "Golf",
    start_url: "/",
    display: "standalone",
    // Fond clair de la palette (spec `visual-theme` « Couleurs du manifest »).
    background_color: BRAND_COLORS.paper,
    theme_color: BRAND_COLORS.paper,
    lang: "fr",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
