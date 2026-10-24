# Proposal

## Why

`refresh-mobile-ui` a donné à l'app une palette et une marque, mais les écrans restent des composants shadcn tels qu'installés : cartes arrondies à filet sur chaque liste, badges en pilule, boutons `rounded-md`, Geist seule, une seule échelle de tailles. L'audit Hallmark du 2026-10-24 (base de démonstration de 14 rounds et 3 joueurs, 390 et 1440 px, clair et sombre) relève 8 échecs bloquants (`transition-all` dans Button, Badge et Toggle ; animation de la boîte de confirmation sans repli pour mouvement réduit ; pas de `overflow-x: clip` sur `html` et `body` ; couleurs en dur dans `app-glyph.tsx`), des chaînes jointes par des points médians, une liste de rounds faite de 14 cartes identiques, une carte de score coupée au trou 6 sur téléphone, une colonne « Rang » tronquée et une saisie manuelle entièrement rouge avant toute frappe. Le vert « golf » de la palette est aussi le choix qu'on attend pour la catégorie. L'utilisateur demande une refonte complète, avec une direction propre à l'app plutôt qu'un thème du catalogue.

## What Changes

- **Refonte Hallmark complète, direction sur mesure.** Le skill Hallmark mène la refonte (`/hallmark redesign`, profondeur *full*, portée *app*), en mode *custom* (`references/direction.md`) : pas de thème tiré, une idée propre à ce groupe et à ce jeu, qui décide de la couleur, des polices, des surfaces et de la composition de chaque écran. Le design en propose trois et en retient une.
- **BREAKING (visuel) : fin de la palette Fairway.** Fond papier `#F7F5EF`, vert `#1F5E3B` et sable `#D9C9A3` disparaissent, ainsi que Geist. Les nouvelles couleurs et polices sont des tokens déclarés dans `:root` (clair et sombre) et rien d'autre ne contient de couleur ou de police en dur, icônes d'écran d'accueil comprises.
- **Composants de base repris.** Button, Badge, Toggle, Card, Input, Table, Alert, AlertDialog et les autres `src/components/ui` gardent leur API et leurs `data-slot`, mais perdent le style shadcn par défaut : transitions nommées, focus visible immédiat, états actif et désactivé, repli pour mouvement réduit.
- **Écrans recomposés dans la coquille existante.** Accueil, Rounds, round, Handicaps, Coups, Joueurs, Parcours, Import, correction et saisie manuelle, page de code : même contenu, mêmes routes, même navigation à onglets, mais chaque écran mis en forme autour de son objet (le registre des rounds plutôt qu'une pile de cartes, la carte de score comme objet signature).
- **Textes sans points médians.** « Tees Red · 17 octobre 2026 · Par 71 » et « BETHPAGE BLACK · Red » deviennent des lignes ou des champs séparés ; la ligne de version (un seul point, forme de signature) reste.
- **Saisie manuelle calme au départ.** Une case vide d'une saisie neuve se montre « à remplir » sans couleur d'erreur ; la couleur d'erreur reste pour les contrôles en échec. Le compte de problèmes du bouton ne change pas.
- **Classement lisible à 320 px.** Les colonnes du classement net d'un round tiennent sur un téléphone sans en couper une.
- **Téléphone d'abord, sans défilement horizontal.** Le groupe se sert de l'app au téléphone : chaque écran est conçu à 390 px, vérifié à 320 px, puis étendu à l'ordinateur. Sous 768 px, rien ne défile de côté, ni la page ni un cadre : la carte de score empile l'aller et le retour, la grille de correction passe à une ligne par trou. Le défilement dans un cadre ne reste qu'à partir de 768 px, quand 18 trous ne tiennent pas.
- **En-tête net sous la barre d'état d'iPhone.** Dans Safari iOS 26, la marque et « Golf » passent aujourd'hui sous le flou que Safari pose sous la barre d'état. L'en-tête devient collé et opaque, de la même couleur que la page, et le manifest prend les couleurs de la palette.
- **Hors périmètre** : nouvelles fonctions ou données, changement de routes ou de navigation, renommage de sections, nouveau mode clair/sombre manuel, refonte de la logique de l'éditeur ou de l'import.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `visual-theme` : la palette Fairway est remplacée par une palette sur mesure tenue en tokens ; les marques de score et la marque d'app suivent ces tokens ; nouvelles exigences sur le mouvement et le focus des contrôles.
- `home-dashboard` : le bloc du dernier round n'affiche plus le parcours et les tees joints par un point médian.
- `app-shell` : sous 768 px, aucun cadre ne défile horizontalement non plus ; les cases de la grille offrent 44 px de haut ; le contenu défilant signalé ne vaut plus qu'à partir de 768 px.
- `rounds` : l'en-tête d'un round n'est plus une chaîne à points médians ; le classement net tient à 320 px ; sur téléphone, la carte de score empile aller et retour au lieu de défiler.
- `scorecard-import` : une case vide d'une saisie neuve n'est pas affichée en erreur avant d'avoir été quittée vide ; sur téléphone, la grille de correction présente une ligne par trou, sans défilement horizontal.

## Impact

- **Code** : `src/app/globals.css` (tokens, base, styles des surfaces), `src/app/layout.tsx` (polices, `themeColor`), `src/app/app-glyph.tsx`, `src/app/manifest.ts`, `src/components/ui/*`, `src/components/app-nav.tsx`, `nav-link.tsx`, `page-title.tsx`, `brand-mark.tsx`, `scroll-frame.tsx`, et les pages et composants de chaque écran (`src/app/(app)/**/page.tsx`, `src/app/login/*`, `src/components/{rounds,handicaps,strokes,players,courses,import,round-editor,scores}/*`). Nouveaux `tokens.css` et `base.css` écrits par le scaffold Hallmark et importés par `globals.css`.
- **Outillage** : le skill Hallmark (`.claude/skills/hallmark`, `.agents/skills/hallmark`, `skills-lock.json`) entre dans le dépôt ; `.hallmark/` garde l'enregistrement « avant » (ignoré par git sauf le journal et le sel) pour la vérification `--kept`.
- **Tests** : e2e qui lisent les textes à points médians (`tests/e2e/rounds.spec.ts`, `home.spec.ts`) suivent la nouvelle spec ; nouveaux scénarios e2e pour la saisie manuelle, le classement à 320 px et l'absence de défilement horizontal sur chaque route à 320 et 390 px ; dans `mobile.spec.ts`, le test du fondu de la grille de correction passe de 390 à 800 px (spec `app-shell` modifiée) ; `layout-width.spec.ts` et `app-shell.spec.ts` doivent rester verts sans modification. Aucun `data-testid`, `name`, `id` ou `href` lu par un test ne disparaît.
- **Dépendances** : polices auto-hébergées par `next/font` (Google Fonts ou fichiers libres), pas de nouveau paquet. Pas de migration de base.
- **Changes en cours** : `add-course-rating` (29/30 tâches, code fusionné) touche `courses/page.tsx` et le requirement « Classement net d'un round » ; ce change ajoute un requirement à côté sans le modifier. `improve-local-dev-experience` n'est pas concerné.
