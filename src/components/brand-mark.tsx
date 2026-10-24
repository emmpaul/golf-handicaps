/** Drapeau décoratif, aux mêmes proportions que l'icône d'écran d'accueil. */
export function BrandMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" className="size-8 shrink-0 rounded-md">
      <rect width="100" height="100" rx="16" fill="var(--primary)" />
      <ellipse cx="50" cy="75" rx="32" ry="9" fill="var(--sand)" />
      <ellipse cx="51" cy="74.5" rx="5" ry="2.5" fill="var(--primary-foreground)" />
      <path d="M51 16v59" stroke="var(--primary-foreground)" strokeWidth="4" />
      <path d="M53 16h28v20H53z" fill="var(--birdie)" />
    </svg>
  );
}
