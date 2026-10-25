/**
 * Drapeau décoratif, même dessin que l'icône d'écran d'accueil (`app-glyph.tsx`) : bloc d'encre
 * à coins droits, green en encre secondaire, fanion rouge « sous le par ». Couleurs en tokens,
 * elles suivent le mode sombre.
 */
export function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="size-8 shrink-0">
      <rect width="100" height="100" fill="var(--color-ink)" />
      <ellipse cx="50" cy="75" rx="32" ry="9" fill="var(--color-ink-2)" />
      <ellipse cx="51" cy="74.5" rx="5" ry="2.5" fill="var(--color-paper)" />
      <path d="M51 16v59" stroke="var(--color-paper)" strokeWidth="4" />
      <path d="M53 16h28v20H53z" fill="var(--color-signal)" />
    </svg>
  );
}
