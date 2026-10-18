import { ImageResponse } from "next/og";
import { AppGlyph } from "./app-glyph";

/** Icône d'écran d'accueil d'iOS, servie à `/apple-icon`. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppGlyph side={size.width} />, size);
}
