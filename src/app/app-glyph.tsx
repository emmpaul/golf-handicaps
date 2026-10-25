import { BRAND_COLORS } from "./brand-colors";

/**
 * Icône de l'app pour `next/og` : un drapeau de green sur fond d'encre, dessiné en blocs, dans
 * les couleurs de la palette (`brand-colors.ts`, `next/og` ne lit pas le CSS).
 * Ni emoji ni police : `ImageResponse` irait les chercher sur le réseau et casserait le build
 * hors ligne. Tout tient dans les 80 % du centre, pour les masques ronds d'Android.
 */
export function AppGlyph({ side }: { side: number }) {
  // Coordonnées en centièmes du côté.
  const at = (value: number) => (value * side) / 100;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        background: BRAND_COLORS.ink,
      }}
    >
      {/* Green */}
      <div
        style={{
          position: "absolute",
          left: at(18),
          top: at(66),
          width: at(64),
          height: at(18),
          borderRadius: "50%",
          background: BRAND_COLORS.ink2,
        }}
      />
      {/* Trou */}
      <div
        style={{
          position: "absolute",
          left: at(46),
          top: at(72),
          width: at(10),
          height: at(5),
          borderRadius: "50%",
          background: BRAND_COLORS.paper,
        }}
      />
      {/* Mât */}
      <div
        style={{
          position: "absolute",
          left: at(49),
          top: at(16),
          width: at(4),
          height: at(59),
          background: BRAND_COLORS.paper,
        }}
      />
      {/* Fanion : un rectangle, le moteur de `next/og` ne trace pas de triangle en bordures */}
      <div
        style={{
          position: "absolute",
          left: at(53),
          top: at(16),
          width: at(28),
          height: at(20),
          background: BRAND_COLORS.signal,
        }}
      />
    </div>
  );
}
