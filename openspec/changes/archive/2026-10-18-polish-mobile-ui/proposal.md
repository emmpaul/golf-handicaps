# Proposal

## Why

L'app sert surtout au téléphone, souvent ajoutée à l'écran d'accueil de l'iPhone. Un audit à 320, 375, 390 et 430 px (WebKit iPhone 15) et à 768, 1024 et 1440 px (Chromium) donne ceci :

- La page ne défile de côté que dans un seul cas : le calendrier de la date de jeu à 320 px (+9 px).
- Plusieurs écrans sont pourtant coupés ou pénibles au doigt :
  - la navigation du haut défile de côté et cache « Coups » et « Joueurs » ;
  - la colonne « Compte » des handicaps est à moitié masquée dans sa boîte ;
  - les listes déroulantes en 14 px font zoomer iOS au focus ;
  - la plupart des boutons et champs font 32 px de haut.
- En mode écran d'accueil, rien n'est prévu : pas de manifest, pas d'icône, pas de `viewport-fit=cover`, aucune marge de zone sûre. La barre « Enregistrer » collée en bas passe sous la barre d'accueil de l'iPhone.
- Sur ordinateur, il reste quelques défauts :
  - la table du classement s'étire sur 1 248 px ;
  - la courbe des handicaps laisse un grand vide à côté de sa table ;
  - le bord de la barre « Enregistrer » dépasse le contenu ;
  - la page courante n'est pas indiquée dans la navigation.

## What Changes

- **Navigation mobile en bas** : sous `md`, une barre d'onglets fixe en bas montre les 5 sections, chacune avec une icône et un libellé, sans défilement, au-dessus de la barre d'accueil. L'en-tête du haut ne garde que « ⛳ Golf ». À partir de `md`, la navigation reste en haut. Partout, la page courante est marquée (style et `aria-current="page"`).
- **App installable** : un manifest (nom « Handicaps golf », nom court « Golf », `display: standalone`, couleurs), une icône d'app et une `apple-touch-icon`. `viewport-fit=cover` et `themeColor` sont ajoutés. L'en-tête, la barre d'onglets et la barre « Enregistrer » respectent les zones sûres (encoche, barre d'accueil). Pas de service worker ni de mode hors ligne.
- **Accès public aux fichiers d'installation** : le manifest et les icônes sont servis sans session, pour que l'écran de connexion puisse être ajouté à l'écran d'accueil et garder son icône. Ils ne contiennent aucune donnée du groupe.
- **Cibles tactiles et zoom iOS** : sous `md`, les boutons, champs et listes déroulantes partagés passent à 44 px de haut et à un texte de 16 px. Sur ordinateur, ils gardent leur taille. Les liens texte isolés (« Vérifier », « Recadrer la photo », « Saisir un round à la main »…) ont une zone de toucher de 44 px.
- **Rien de coupé sur téléphone** :
  - le calendrier tient dans 320 px ;
  - la marque « Compte » des handicaps reste visible sans défilement ;
  - les lignes de la liste des imports ne se cassent plus de travers ;
  - sur téléphone, le champ fichier natif (« Choose File / no file selected ») est remplacé par un bouton stylé, en gardant le libellé « Photo de la carte ».
- **Passe ordinateur** :
  - le classement net prend une largeur bornée ;
  - la courbe d'index prend la hauteur de sa table ;
  - la barre « Enregistrer » est alignée sur le contenu ;
  - les dates des imports suivent le format du reste de l'app ;
  - libellés et hauteurs sont homogénisés sur Coups et Joueurs.
- **Garde-fou e2e** : le test « pas de défilement horizontal » couvre toutes les pages et les états ouverts (calendrier, dialogue) à 320 et 390 px, et non plus le seul parcours d'import.

## Capabilities

### New Capabilities

- `app-shell` : le cadre commun à toutes les pages sur téléphone et ordinateur. Il couvre la navigation entre sections, l'installation à l'écran d'accueil et le mode plein écran (zones sûres), l'absence de défilement horizontal de la page, et la taille des cibles tactiles et du texte des champs.

### Modified Capabilities

- `app-access` : l'exigence « Accès protégé par code partagé » admet une deuxième exception, en plus de la page de saisie du code : le manifest et les icônes d'app, servis sans session.

## Impact

- **Code** :
  - `src/app/layout.tsx` (export `viewport`, métadonnées `appleWebApp`) ;
  - nouveaux `src/app/manifest.ts`, `src/app/icon.tsx` et `src/app/apple-icon.tsx` ;
  - `src/proxy.ts` et `src/lib/auth/access.ts` ;
  - `src/components/app-nav.tsx` (en-tête et barre d'onglets) et `src/app/(app)/layout.tsx` ;
  - `src/components/ui/button.tsx`, `input.tsx` et `native-select.tsx` ;
  - `src/components/round-editor/round-editor.tsx` et `date-field.tsx` ;
  - `src/app/(app)/handicaps/page.tsx` et `src/components/handicaps/index-curve.tsx` ;
  - `src/app/(app)/rounds/[id]/page.tsx` ;
  - `src/components/import/import-list.tsx` et `import-flow.tsx` ;
  - les pages Coups et Joueurs.
- **Tests** :
  - `tests/e2e/mobile.spec.ts` est étendu ;
  - nouveau `tests/e2e/app-shell.spec.ts`, ajouté à `MOBILE_SPECS` ;
  - `tests/e2e/layout-width.spec.ts` reste vert ;
  - nouveau test unitaire de `decideAccess`.
- **Dépendances** : aucune. Les icônes sont dessinées avec `next/og`, déjà fourni par Next.
- **Ordre** : la PR #19 (`add-thinking-orb-loaders`) touche `import-flow.tsx`, `round-editor.tsx` et `import-list.tsx`. Rebaser ce change sur `main` après sa fusion.
- **Hors périmètre** :
  - mode hors ligne et service worker ;
  - thème sombre ;
  - le formulaire de nouveau round, qui s'ouvre en affichant déjà ses 57 problèmes : c'est une règle de validation, pas de mise en page ;
  - toute refonte visuelle des couleurs ou de la typographie.
