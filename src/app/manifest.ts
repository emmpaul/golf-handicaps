import type { MetadataRoute } from "next";

/** Manifest servi à `/manifest.webmanifest`, ouvert sans session (voir `decideAccess`). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Handicaps golf",
    short_name: "Golf",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "fr",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
