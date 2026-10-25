/**
 * Couleurs de la palette en hex, pour ce qui ne lit pas le CSS : les icônes `next/og`
 * (`ImageResponse`), le `themeColor` de `layout.tsx` et le manifest (design D5). Chaque valeur
 * recopie un token de `tokens.css` ; `tests/app/brand-colors.test.ts` échoue si l'un change
 * sans l'autre.
 */
export const BRAND_COLORS = {
  /** `--color-paper`, mode clair : fond, en-tête, `theme-color` et manifest. */
  paper: "#F4F7FB",
  /** `--color-paper`, mode sombre. */
  paperDark: "#0A111F",
  /** `--color-ink`, mode clair : fond de l'icône. */
  ink: "#0F1D3E",
  /** `--color-ink-2`, mode clair : le green de l'icône. */
  ink2: "#46566E",
  /** `--color-signal`, mode clair : le fanion, rouge « sous le par ». */
  signal: "#CB1E21",
} as const;
