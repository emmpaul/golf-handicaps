# Design: golf-handicaps

The locked system. Every Hallmark run reads this first and screens share it. Change it on purpose; the file is the rule.

## System
- Genre: modern-minimal
- Shape of the first page: app screen (scope app; the shell stays: top header, bottom tab bar under 768px, safe areas, `max-w-7xl`)
- Theme: custom (vibe: "tableau d'affichage froid, encre dense, un rouge de score")
- Idea: the app is the group's leaderboard. Golf already has its colour code (red under par, ink above), and figures set large are the only picture.
- Axes: light/display-condensed/chromatic-red · posture: restrained (one chromatic, and it carries meaning)
- Signature: the round scorecard, full width, front nine above back nine under 768px

## Tokens
`src/app/tokens.css` is the source of truth (light in `@theme static`, dark in the `prefers-color-scheme` block); shadcn and app variables point at it in `globals.css`. The roles:
```css
:root {
  --color-paper: oklch(0.975 0.006 245);  /* #F4F7FB · dark #0A111F · page, header, html/body, theme-color */
  --color-paper-2: oklch(0.945 0.01 248); /* #E8EEF3 · hover row, muted, popover, dialog scrim */
  --color-paper-3: oklch(0.905 0.014 250);/* #D9E1E9 · selected row, ::selection, shadcn accent */
  --color-ink: oklch(0.24 0.065 264);     /* #0F1D3E · text, primary action, 2px rule, current tab */
  --color-ink-2: oklch(0.45 0.045 258);   /* #46566E · secondary text, over-par mark */
  --color-ink-3: oklch(0.51 0.03 255);    /* #5B6777 · placeholder, field border */
  --color-rule: oklch(0.86 0.014 250);    /* #CAD2DA · 1px rule */
  --color-band: var(--color-ink);         /* table head band; dark #223251 */
  --color-signal: oklch(0.54 0.205 27);   /* #CB1E21 · under par, birdie, net winner; never a button fill */
  --color-error: oklch(0.52 0.12 58);     /* #9B540C · destructive and errors, rust so red never means error */
  --color-ai: oklch(0.55 0.095 210);      /* #018090 · cell completed by the AI, 15% tint */
  --color-focus: oklch(0.53 0.19 258);    /* #0B66D6 · 2px focus outline */
  --font-display: "Sofia Sans Condensed"; /* 600/800, tabular figures: names, indexes, scores, titles */
  --font-body: "IBM Plex Sans";           /* 400/500, 16px: text, labels, buttons */
  --radius-card: 0;  --shadow-card: none;  --rule-hair: 1px;
}
```
Renamed from Hallmark: `accent` is `--color-signal`, `muted` is `--color-ink-3` (shadcn owns both names). `src/app/brand-colors.ts` copies the hex values for `next/og`, `themeColor` and the manifest; `tests/app/brand-colors.test.ts` keeps it in step. The spacing scale, type scale (1.2), easings and durations are the scaffold's, in `tokens.css`.

## Containers
- One container: a block ruled by a 2px ink line on top (`Card`), no corners, no shadow, no hairline frame. Never a card inside a card.
- Tables before cards: lists of rounds, players and courses are table rows. Head under a 2px ink rule, rows on 1px `rule`; a leaderboard head may sit on the `band` with `band-ink` text.
- Callouts (`Alert`): `paper-2` with a 2px top rule, rust for errors.

## Controls
- Primary: ink fill, paper text · square · 44px under 768px, 32px from 768px (lg 36px)
- Secondary: 1px ink outline or text · same corners and height
- Destructive: 1px rust outline, rust text; confirmed in an `AlertDialog` on an opaque `paper-2` scrim
- Badge: square, 1px ink outline or plain secondary text; never a filled pill
- Toggle and segments: square; pressed is an ink fill
- Inputs: 1px `ink-3` border, ink on hover, inset focus outline; 16px text under 768px; `aria-invalid` turns the border rust
- Every control: hover, `active:`, `disabled:` (opacity 0.55, `cursor: not-allowed`), and a 2px `--color-focus` outline on `:focus-visible` that appears at once (no transition on outline)

## Motion
- Character: severe. Transitions name their properties (`color`, `background-color`, `border-color`) at `--dur-micro`; never `transition-all`, never outline. Dialog and popover fade and zoom from 95%; under reduced motion they open with no animation at all.

## Screen rules
- Phone first: compose at 390px, check at 320px, then extend. Under 768px nothing scrolls sideways, page or frame.
- Header sticky and opaque, the same `paper` as `html` and `body`, 8px under the safe area.
- No middle-dot meta strings: course, tees, date and par are separate elements. Typographic apostrophes.
- Red marks a score fact only (under par, birdie, net winner). Errors are rust.
- Every region keeps the states it has logic for (loading, empty, error, full); missing ones go to the owner.

## Exports
`src/app/tokens.css` in this project; the shadcn mapping lives in `src/app/globals.css` (`:root`). Tailwind utilities read the tokens through `@theme`.
