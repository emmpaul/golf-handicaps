import { ImageResponse } from "next/og";
import { AppGlyph } from "./app-glyph";

/** Tailles demandées par le manifest, servies à `/icon/192` et `/icon/512`. */
const SIDES = [192, 512];

export function generateImageMetadata() {
  return SIDES.map((side) => ({
    id: String(side),
    size: { width: side, height: side },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const side = Number(await id);
  return new ImageResponse(<AppGlyph side={side} />, { width: side, height: side });
}
