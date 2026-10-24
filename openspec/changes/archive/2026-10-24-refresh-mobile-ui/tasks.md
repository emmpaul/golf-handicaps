# Tasks

## 1. Palette Fairway et thème sombre

- [x] 1.1 Écrire `tests/app/theme-contrast.test.ts` (rouge d'abord) : lit `src/app/globals.css`, extrait les variables de `:root` et du bloc `prefers-color-scheme: dark`, et vérifie un contraste ≥ 4,5:1 pour `foreground`/`background`, `muted-foreground`/`background`, `primary-foreground`/`primary`, dans les deux modes, et `--background` clair égal à `#F7F5EF` (converti). Mutation à nommer : `--muted-foreground` sombre remis à `oklch(0.45 0 0)`.
- [x] 1.2 Réécrire les variables de `globals.css` (design, décision 1) : valeurs Fairway claires, bloc sombre sous `@media (prefers-color-scheme: dark)`, `@custom-variant dark` en requête média, nouvelles `--birdie`, `--bogey`, `--sand` exposées dans `@theme inline`, `--chart-*` en rampe verte. `pnpm test tests/app/theme-contrast.test.ts` passe.
- [x] 1.3 Lire la doc `Viewport.themeColor` dans `node_modules/next/dist/docs/`, puis passer `themeColor` de `layout.tsx` au tableau clair / sombre. E2E `tests/e2e/theme.spec.ts` : deux balises `meta[name=theme-color]` avec `media` clair et sombre (spec `visual-theme`) ; en `colorScheme: "dark"`, le `background-color` calculé de `body` sur `/rounds` est la valeur sombre. Mutation à nommer : `themeColor` remis à `"#ffffff"`.
- [x] 1.4 Poser `tabular-nums` sur le composant `table` (`src/components/ui/table.tsx`) et retirer les `tabular-nums` cellule par cellule devenus redondants. E2E : sur `/handicaps`, la `font-variant-numeric` calculée d'une cellule « Index après » contient `tabular-nums`.

## 2. Marque d'app et barre d'onglets

- [x] 2.1 Créer `src/components/brand-mark.tsx` (SVG du drapeau, `aria-hidden`, couleurs par variables) et l'utiliser dans `app-nav.tsx` à la place de « ⛳ » (design, décision 2). Passer les couleurs d'`app-glyph.tsx` aux hex Fairway. Étendre `tests/e2e/app-shell.spec.ts` : le lien d'en-tête a le nom accessible « Golf » et son texte ne contient pas « ⛳ ».
- [x] 2.2 Onglet courant : pastille `bg-primary/12` derrière l'icône et texte `text-primary` (design, décision 9). Étendre `app-shell.spec.ts` sur `/rounds/<id>` à 390 px : seul l'onglet « Rounds » a une pastille visible (élément `data-slot="tab-pill"` présent et non transparent). Mutation à nommer : pastille posée sans condition `aria-current`.

## 3. Cadre défilant signalé

- [x] 3.1 Écrire `tests/components/scroll-frame.test.tsx` (rouge d'abord, jsdom avec `scrollWidth`/`clientWidth`/`scrollLeft` simulés) : au début `data-overflow-end` seul, au milieu les deux, à la fin `data-overflow-start` seul, contenu qui tient : aucun. Mutation à nommer : comparaison `scrollLeft > 0` remplacée par `>= 0`.
- [x] 3.2 Créer `src/components/scroll-frame.tsx` (design, décision 4) et l'utiliser dans `score-grid.tsx` à la place du `div` `overflow-x-auto`. E2E dans `tests/e2e/mobile.spec.ts` sur l'écran de correction à 390 px : `data-overflow-end` présent au départ ; après défilement jusqu'au trou 18, `data-overflow-start` présent et le libellé « Par » toujours visible ; à 1440 px, aucun des deux attributs.

## 4. Éditeur et écran d'import

- [x] 4.1 Lignes de joueur en deux rangées dans `line-players.tsx` (design, décision 8). E2E dans `mobile.spec.ts` à 390 et 320 px : pour chaque ligne, la liste « Joueur de la ligne n » et le bouton de retrait ont le même `y` (à 2 px près). Vérifier que `correction.spec.ts` et `manual-entry.spec.ts` passent.
- [x] 4.2 Écran d'import : « Choisir une photo » en `variant="outline"` sous « Prendre une photo », libellé « Photo de la carte » en `sr-only` (design, décision 9). Étendre `camera-capture.spec.ts` : en contexte tactile, aucun texte visible « Photo de la carte » entre les deux boutons et `getByLabel("Photo de la carte")` trouve toujours le champ. `import-photo.spec.ts` passe.

## 5. Carte de score d'un round

- [x] 5.1 Écrire `tests/components/score-mark.test.tsx` (rouge d'abord) : 3 sur par 4 → cercle (`data-mark="birdie"`) et texte « 3, birdie » ; 5 sur par 4 → `data-mark="bogey"` et « 5, bogey » ; 4 sur par 4 → aucun `data-mark`. Mutation à nommer : `<` remplacé par `<=` dans la comparaison au par.
- [x] 5.2 Créer `src/components/scores/score-mark.tsx` (design, décision 3), puis `src/components/rounds/round-scorecard.tsx` dans un `ScrollFrame` : colonnes 1–9, OUT, 10–18, IN, TOT ; lignes Par, Index et une par joueur, avec `ScoreMark`. Données via `getRoundForm` dans `rounds/[id]/page.tsx`, sous le classement net.
- [x] 5.3 Étendre `tests/e2e/rounds.spec.ts` sur le round de référence : Gab « 5 » au trou 1, « 38 » OUT, « 34 » IN, « 72 » TOT, Manu « 88 » TOT ; la case de Gab au trou 7 porte `data-mark="birdie"` et celle du trou 1 `data-mark="bogey"` ; à 390 px la page ne défile pas horizontalement et « Gab » reste visible après défilement de la carte.

## 6. Handicaps sur téléphone

- [x] 6.1 Écrire le test de `formatSignedTenths` dans `tests/lib/format.test.ts` (rouge d'abord) : 3 → « +0,3 », −3 → « −0,3 » (U+2212), 0 → « = », 158 → « +15,8 ». Mutation à nommer : tiret ASCII au lieu de U+2212. Puis l'ajouter à `src/lib/format.ts`.
- [x] 6.2 Page Handicaps (design, décision 6) : sélecteur `?joueur=<id>` sous `md`, sections masquées `max-md:hidden` sauf la choisie, repli sur le premier joueur pour un id absent ou inconnu ; résumé en tête de section (index en grand, écart, « provisoire ») ; date et « Compte » sur une rangée sous `md`.
- [x] 6.3 Étendre `tests/e2e/handicaps.spec.ts` : à 390 px, Gab choisi par défaut et seule sa section visible ; toucher « Manu » puis recharger garde Manu ; `?joueur=999` affiche Gab ; à 1024 px les trois sections visibles et pas de sélecteur ; à 320 px la date et « Compte » d'un différentiel retenu ont le même `y` ; le résumé montre l'index et l'écart attendus des données e2e (valeurs écrites à la main depuis `tests/e2e/data.ts`).

## 7. Coups : grille de 18 trous

- [x] 7.1 Remplacer `holesText` par `StrokesGrid` dans `strokes-planner.tsx` (design, décision 7) et le titre « {nom} ne reçoit aucun coup » sans grille.
- [x] 7.2 Réécrire `tests/e2e/strokes.spec.ts` sur la spec `match-strokes` : 16 coups → `aria-label` « Trou 3 : aucun coup » et « Trou 14 : aucun coup », les 16 autres « 1 coup » ; 20 coups → « Trou 15 : 2 coups » et « Trou 4 : 2 coups » ; Gab en « Écart » → « Gab ne reçoit aucun coup » et aucune grille ; à 320 px, pas de défilement horizontal de page ni de la grille. Mutation à nommer : `grid-cols-9` remplacé par `grid-cols-18`.

## 8. Accueil en tableau de bord

- [x] 8.1 Écrire `tests/server/home/summary.test.ts` (rouge d'abord) sur une base de test : joueur à deux rounds (index 155 puis 158) → `deltaT` 3 ; joueur à un round → `deltaT` `null` ; joueur sans round → `indexT` `null` ; dernier round = le plus récent par date de jeu ; imports `ready` sans round comptés, `ready` avec round ignoré. Mutation à nommer : `at(-2)` remplacé par `at(0)`.
- [x] 8.2 Créer `src/server/home/summary.ts` (`homeSummary`, design, décision 5) en composant `playerOverviews`, `listRounds` et `listImports`.
- [x] 8.3 Réécrire `src/app/(app)/page.tsx` : titre, bouton « Importer une carte », cartes joueurs (index, écart, « provisoire », « pas encore d'index ») vers `/handicaps?joueur=<id>`, carte du dernier round ou « Aucun round enregistré », bloc « N import(s) à vérifier » s'il y en a, `LogoutButton` en bas. Retirer `description` de `LINKS`.
- [x] 8.4 Étendre `tests/e2e/home.spec.ts` : « Importer une carte » mène à `/import` ; aucun texte « Index simulateur et son évolution. » ; les valeurs d'index et d'écart et le dernier round des données e2e (écrites à la main) ; après un import prêt (`tests/e2e/import.ts`), « 1 import à vérifier » mène à `/imports/<id>`. `access.spec.ts` (déconnexion depuis l'accueil) passe.

## 9. Finitions

- [x] 9.1 Page Parcours : placeholders « ex. 71,4 » et « ex. 144 ». `courses.spec.ts` passe.
- [x] 9.2 Joueurs : espacement des cartes resserré, « Retirer » en bouton `ghost` de 44 px de haut sous `md`. `players.spec.ts` passe ; étendre `mobile.spec.ts` : « Retirer » mesure au moins 44 px de haut à 390 px.

## 10. Vérification d'ensemble

- [x] 10.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd` passent (`layout-width.spec.ts` couvre toutes les pages à 320 et 390 px).
- [x] 10.2 Captures à 390 px, en clair et en sombre, de l'accueil, Importer, la correction, Rounds, un round, Handicaps, Coups, Joueurs et Parcours, jointes à la PR.
