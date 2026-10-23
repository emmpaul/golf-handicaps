# Design

## Context

Voir `proposal.md` pour la motivation. État observé le 2026-10-23 (commit `e9b70a6`), sur une base de travail à 15 rounds, 3 joueurs et un import lu de `gspro-img3064.jpg`, pages rendues à 390, 320 et 1280 px :

- **Thème.** `src/app/globals.css` porte les variables shadcn `base-nova` d'origine, toutes en gris (`oklch(… 0 0)`), avec un bloc `.dark` jamais activé : `@custom-variant dark (&:is(.dark *))` et aucune classe `dark` posée. Les composants `src/components/ui/*` et `score-grid.tsx` utilisent déjà des variantes `dark:`. `layout.tsx` fixe `themeColor: "#ffffff"`. Couleurs codées en dur hors variables : seulement `app-glyph.tsx` (icônes `next/og`, `#14532d` / `#22c55e`) et `themeColor`.
- **En-tête et onglets.** `app-nav.tsx` : lien « ⛳ Golf » en texte ; l'onglet courant ne change que de graisse et de couleur de texte (`aria-[current=page]:`).
- **Accueil.** `src/app/(app)/page.tsx` : `PageTitle`, la liste `LINKS` en cartes (doublon de la barre d'onglets), `LogoutButton`. Données disponibles sans requête nouvelle : `playerOverviews` (historique par joueur, `indexT`, `provisional`), `listRounds`, `listImports` (statut `ready` et `roundId`).
- **Round.** `rounds/[id]/page.tsx` : titre, résumé, rating, `NetLeaderboard`, boutons. Aucun score par trou ; `getRoundForm` (`src/server/rounds/edit.ts`) sait déjà lire par, index, distance et scores d'un round.
- **Handicaps.** Composant serveur ; une section par joueur (courbe `IndexCurve` + tableau). Sous `md`, la marque « Compte » passe sous la date (`mt-1 block md:hidden`). À 390 px la page fait plus de 8 000 px.
- **Grille de correction.** `score-grid.tsx` : `overflow-x-auto`, colonne des libellés déjà `sticky left-0`. Rien n'indique les 12 trous hors cadre à 390 px.
- **Lignes de joueur.** `line-players.tsx` : `flex flex-wrap` sur une seule rangée (`Ligne n`, `lu « … »`, liste, bouton) ; à 390 px le bouton ✕ tombe seul sur sa rangée.
- **Coups.** `strokes-planner.tsx` : « Gab reçoit 0 coup » puis « Aucun coup », sinon « Trous : 1, 4, 5, … » (`data-testid="strokes-holes"`, ciblé par `tests/e2e/strokes.spec.ts`).
- **Contraintes en place** (spec `app-shell`) : cibles de 44 px et texte de champ à 16 px sous `md`, pas de défilement horizontal de page dès 320 px, zones sûres, cases de score 44 × 36 px.

## Goals / Non-Goals

**Goals:**

- Un seul endroit pour la palette : les variables de `globals.css`. Aucun composant n'écrit de couleur en dur, sauf les icônes `next/og` qui ne lisent pas le CSS.
- Les vérifications de mise en page des specs (`app-shell`, et celles de ce change) restent des tests e2e à 320 et 390 px.
- Aucun changement de données, de route d'API ni de calcul.

**Non-Goals:**

- Bascule de thème dans l'app (le système décide).
- Nouveau composant shadcn installé : `toggle-group`, `badge`, `card`, `table` suffisent.
- Refonte de l'écran de recadrage, des dialogues et du calendrier au-delà de ce que la palette change.

## Decisions

### 1. Palette en variables, sombre par `prefers-color-scheme`

Redéfinir les variables de `:root` avec les valeurs Fairway (en `oklch`, converties des hex de la spec `visual-theme`) et ajouter trois variables : `--birdie`, `--bogey`, `--sand` (exposées en `--color-*` dans `@theme inline`). Le thème sombre passe de la classe `.dark` à une requête média :

- `@custom-variant dark (@media (prefers-color-scheme: dark));` pour que les `dark:` existants des composants suivent le système ;
- le bloc `.dark { … }` devient `@media (prefers-color-scheme: dark) { :root { … } }`.

Valeurs sombres de départ : fond `#0F1713`, surfaces `#17221C`, texte `#E6EDE8`, principale `#4FA872` (vert éclairci pour garder 4,5:1 sur le fond sombre avec texte foncé dessus), sable `#BFAE84`, birdie `#E0574C`, bogey `#C9D3DC` (le carré passe en contour clair). `--chart-*` reçoivent une rampe verte au lieu du gris.

`themeColor` devient un tableau `[{ media: "(prefers-color-scheme: light)", color: "#F7F5EF" }, { media: "(prefers-color-scheme: dark)", color: "#0F1713" }]` (API `Viewport` de Next, à vérifier dans `node_modules/next/dist/docs/` avant d'écrire).

Alternative écartée : `next-themes` et une classe `.dark` posée côté client. Une dépendance et un script de plus pour un réglage que le groupe ne veut pas dans l'app ; la requête média ne clignote pas au chargement.

### 2. Marque d'app réutilisée

`AppGlyph` (`src/app/app-glyph.tsx`) dessine déjà le drapeau pour `next/og` en `div` positionnées. Extraire le dessin en un petit composant SVG `BrandMark` (`src/components/brand-mark.tsx`) aux mêmes proportions, colorié par `currentColor` / variables pour suivre le thème, et l'utiliser dans `app-nav.tsx` avec `aria-hidden`. `AppGlyph` garde ses `div` (contrainte `ImageResponse`), mais ses couleurs passent aux hex Fairway (`#1F5E3B` fond, sable pour le green) pour que l'icône d'écran d'accueil et l'en-tête se ressemblent.

Alternative écartée : rendre `AppGlyph` en SVG partagé. `ImageResponse` supporte mal le SVG imbriqué ; deux dessins de 20 lignes coûtent moins qu'un contournement.

### 3. Une cellule de score commune

Nouveau `ScoreMark` (`src/components/scores/score-mark.tsx`) : prend `strokes` et `par`, rend le chiffre, un cercle `border-birdie` sous le par, un carré `border-bogey` au-dessus, rien au par, et un texte `sr-only` (« birdie », « bogey » ; « eagle » et « double bogey » restent « birdie » et « bogey » pour la spec, un libellé plus fin n'est pas demandé). Utilisé par la carte de score du round. La grille de correction n'en a pas besoin (cases éditables, pas encore un round enregistré).

### 4. Cadre défilant avec fondus

Nouveau composant client `ScrollFrame` (`src/components/scroll-frame.tsx`) : un `div` `overflow-x-auto` qui observe `scrollLeft`, `scrollWidth` et `clientWidth` (événement `scroll` + `ResizeObserver`) et pose `data-overflow-start` / `data-overflow-end` ; deux pseudo-éléments en dégradé de `--background` vers transparent s'affichent selon ces attributs. La colonne `sticky left-0` reste dans le contenu, avec un fond `bg-background` déjà présent ; le fondu gauche se place après elle (décalage égal à la largeur de la colonne, passé en variable CSS par le consommateur).

Consommateurs : `score-grid.tsx` (remplace son `div` `overflow-x-auto`), carte de score du round. La grille des coups n'en a pas besoin (deux rangées de 9 tiennent à 320 px, décision 7).

Alternative écartée : fondu purement CSS (`mask-image` avec `animation-timeline: scroll()`). Safari iOS ne gère pas encore les scroll-driven animations dans toutes les versions utilisées par le groupe ; un attribut posé en JS marche partout et se teste en e2e.

### 5. Accueil : une lecture serveur dédiée

Nouveau `homeSummary(db)` dans `src/server/home/summary.ts`, qui compose les lectures existantes sans nouvelle requête SQL :

- joueurs : `playerOverviews` → `{ name, indexT, provisional, deltaT }` où `deltaT = history.at(-1).indexAfterT − history.at(-2).indexAfterT` (l'index d'avant le dernier round est l'index après l'avant-dernier) ; avec un seul round, `deltaT` vaut `null` et aucun écart ne s'affiche ;
- dernier round : premier élément de `listRounds` ;
- imports à vérifier : `listImports` filtré sur `status === "ready" && roundId === null`, avec le nombre et l'`id` du plus récent.

L'écart se formate avec un helper `formatSignedTenths` dans `src/lib/format.ts` (« +0,3 », « −0,3 » avec le signe moins U+2212, « = » à 0), réutilisé par la page Handicaps.

La page garde `PageTitle` « Handicaps golf » (testé par `home.spec.ts`) et `LogoutButton` (spec `app-access`), placé en bas. Seul l'accueil lit `LINKS[].description` : le champ est retiré de `LINKS` et le commentaire de `app-nav.tsx` mis à jour.

### 6. Handicaps : sélecteur par l'adresse

Le joueur choisi passe par `?joueur=<id>` (`searchParams` de la page serveur), défaut : premier joueur de `listPlayers`. Le sélecteur est une rangée de `Link` stylés en segments (`aria-current="page"` sur le choisi), `md:hidden`. Chaque section reçoit `max-md:hidden` sauf celle du joueur choisi. Ainsi l'ordinateur garde tout, le téléphone n'en montre qu'une, sans état client et avec retour arrière et rechargement gratuits.

Le résumé (index en grand, écart via `formatSignedTenths`, « provisoire ») remplace l'actuel `player-index` en tête de section. La marque « Compte » : la cellule date devient `flex items-center gap-2 whitespace-nowrap` avec la date courte et le `Badge` côte à côte sous `md` ; la colonne dédiée `hidden md:table-cell` reste pour l'ordinateur.

Alternative écartée : `toggle-group` client qui masque les sections. Il faudrait un composant client autour de sections serveur et un état perdu au rechargement.

### 7. Coups : grille de 2 × 9

Remplacer `holesText` par un composant `StrokesGrid` : deux rangées de 9 cases (`grid-cols-9`), numéro du trou en petit en haut, nombre de coups en dessous (« 1 », « 2 » ; case vide et fond neutre à 0 ; fond `primary/15` avec coups). À 320 px : 9 × 30 px + espaces < 288 px de contenu, sans défilement. Le titre devient « {nom} reçoit N coups » ou « {nom} ne reçoit aucun coup » (pas de grille). Le `data-testid="strokes-holes"` passe à la grille ; chaque case porte `aria-label="Trou 4 : 2 coups"` pour que les e2e lisent les valeurs par trou.

### 8. Lignes de joueur en deux rangées

Dans `line-players.tsx`, chaque ligne devient `grid grid-cols-[1fr_auto]` : rangée 1 `Ligne n` + `lu « … »` (col-span 2), rangée 2 la liste (`min-w-0`) et le bouton ✕. Même gabarit à toutes les largeurs : plus simple que deux mises en page, et l'ordinateur y gagne aussi un alignement.

### 9. Finitions sans spec

- **Import** : retirer le libellé visible au-dessus de « Choisir une photo » et donner le nom « Photo de la carte » par `aria-label` / libellé `sr-only`, bouton `variant="outline"` sous le bouton principal.
- **Parcours** : placeholders « ex. 71,4 » et « ex. 144 », pour ne pas les lire comme des valeurs.
- **Joueurs** : espacement plus serré dans les cartes, « Retirer » en bouton `ghost` de 44 px au lieu d'un lien texte.
- **Onglets** : pastille `bg-primary/12` derrière l'icône de l'onglet courant, texte `text-primary` (spec `app-shell`).
- **Typographie** : `tabular-nums` posé une fois sur `table` et sur les grilles (spec `visual-theme`, chiffres alignés), plutôt que cellule par cellule.

## Risks / Trade-offs

- [Le vert principal sur fond papier ne passe pas 4,5:1 pour du petit texte] → `#1F5E3B` sur `#F7F5EF` donne environ 7:1 ; vérifier chaque paire (texte secondaire, sable, badges) avec un calcul de contraste dans un test unitaire sur les valeurs des variables, et ajuster en sombre.
- [Le passage de `.dark` à la requête média casse une variante `dark:` qui supposait la classe] → aucune classe `dark` n'est posée aujourd'hui, donc rien ne dépend d'elle ; capture e2e en `colorScheme: "dark"` sur les pages principales.
- [Tests e2e qui lisent « Aucun coup » et « Trous : … »] → réécrits sur la nouvelle spec `match-strokes` dans la même tâche que la grille.
- [`?joueur=` inconnu ou supprimé] → repli sur le premier joueur, comme sans paramètre.
- [Fondus qui masquent un chiffre de la dernière colonne] → largeur du fondu limitée à 24 px et pointer-events désactivés ; la case reste lisible en fin de défilement puisque le fondu disparaît.

## Migration Plan

Aucune migration de données. Déploiement normal ; retour arrière par la version précédente de l'image. Les PWA déjà installées gardent l'ancienne icône jusqu'à ce que le système la rafraîchisse.
