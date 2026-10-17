# Tasks

**Règles pour tout le change :**

- TDD : chaque comportement commence par un test rouge, qui échoue pour la raison qu'il nomme.
- Les valeurs attendues sont écrites à la main d'après `specs/` : largeurs, hauteurs, libellés exacts.
- Chaque tâche nomme la mutation qui fait passer son test au rouge.
- Les tests mobiles tournent dans le projet `webkit-iphone`. Pour 320 px, utiliser `page.setViewportSize({ width: 320, height: 640 })` dans ce projet.
- `pnpm jscpd` reste à 0 % et chaque commit passe commitlint.
- Avant de commencer, rebaser sur `main` si la PR #19 est fusionnée (voir design, risques).

## 1. Fichiers d'installation ouverts sans session (spec `app-access`)

- [ ] 1.1 TDD (unitaire, `tests/lib/auth/access.test.ts`). Sans jeton, `decideAccess` renvoie `"allow"` pour `GET /manifest.webmanifest`, `/apple-icon`, `/icon/192` et `/icon/512`. Il renvoie `"redirect-login"` pour `/manifest.webmanifest/x`, `/icon-admin` et `/icon/1024`, et `"unauthorized"` pour `POST /manifest.webmanifest`. Mutations : ouvrir par préfixe (`startsWith("/icon")`), ce qui fait passer `/icon-admin` en `"allow"` ; ouvrir aussi l'écriture.

## 2. App installable (spec « Installation sur l'écran d'accueil »)

- [ ] 2.1 Lire `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md`, `app-icons.md` et `04-functions/generate-viewport.md`, puis noter dans la PR toute différence avec le design (URL de `generateImageMetadata`, nom de `viewportFit`).
- [ ] 2.2 TDD (e2e, nouveau `tests/e2e/app-shell.spec.ts`, ajouté à `MOBILE_SPECS`, avec un contexte sans session) :
  - `GET /manifest.webmanifest` répond 200 avec `display === "standalone"`, `start_url === "/"`, `short_name === "Golf"` et des icônes de tailles `["192x192", "512x512"]` ;
  - `/icon/192`, `/icon/512` et `/apple-icon` répondent 200 en `image/png`, avec des dimensions de 192, 512 et 180 px (lues par `sharp(...).metadata()`).

  Mutation : ne pas créer `apple-icon.tsx`, ce qui donne 404.
- [ ] 2.3 TDD (e2e, même fichier) : sur `/login`, la page contient `meta[name=viewport]`, dont le `content` contient `viewport-fit=cover`, `link[rel=manifest]` et `link[rel=apple-touch-icon]`, ainsi que `meta[name=theme-color]` avec `content="#ffffff"`. Mutation : retirer `viewportFit` de l'export `viewport`.
- [ ] 2.4 Implémenter `src/app/app-glyph.tsx`, `icon.tsx`, `apple-icon.tsx` et `manifest.ts`, ainsi que `viewport` et `appleWebApp` dans `layout.tsx`. Vérifier : 2.2 et 2.3 sont verts, et `pnpm build` passe sans réseau (Wi-Fi coupé ou `docker build`).

## 3. Contrôles de 44 px et texte de 16 px sur téléphone (spec « Cibles tactiles »)

- [ ] 3.1 Avant de toucher aux composants, lancer `grep -rn 'size="\(xs\|sm\|icon-xs\|icon-sm\)"' src/app src/components --include='*.tsx' | grep -v components/ui`. Noter le résultat dans la PR. Si un écran utilise une petite taille, l'ajouter à la tâche 3.3.
- [ ] 3.2 TDD (e2e, `app-shell.spec.ts`, iPhone) :
  - sur l'écran de correction d'un import prêt (`seedReadyImport`), la liste « Joueur de la ligne 1 » mesure au moins 44 px de haut et `getComputedStyle(...).fontSize === "16px"` ;
  - sur `/players`, le bouton « Ajouter » et son champ mesurent au moins 44 px ;
  - sur `/import` avec un import prêt, le lien « Vérifier » a une boîte d'au moins 44 px de haut ;
  - une boucle sur tous les `button, input:not([type=checkbox]):not([type=radio]), select, a` visibles de `/import`, `/players`, `/strokes` et de la correction, `textbox` de la `table` exclus, vérifie qu'aucun ne mesure moins de 44 px de haut. Avant la boucle, vérifier que la liste n'est pas vide.

  Mutations : garder `text-sm` sans `text-base` sur `NativeSelect` ; oublier `ACTION_LINK` sur « Vérifier ».
- [ ] 3.3 TDD (e2e, projet `chromium`, 1440 px) : sur `/players`, le bouton « Ajouter » mesure exactement 32 px de haut. Mutation : `h-11` sans `md:h-8`.
- [ ] 3.4 Implémenter les tailles du tableau de la décision 6 dans `button.tsx`, `input.tsx` et `native-select.tsx`. Ajouter `ACTION_LINK` dans `src/lib/utils.ts` et l'appliquer aux liens d'action listés au design. Vérifier : 3.2 et 3.3 sont verts, et `mobile.spec.ts` (poignées de 44 px, grille qui défile) l'est aussi.

## 4. Navigation (specs « Navigation entre sections sur téléphone » et « Section courante indiquée »)

- [ ] 4.1 TDD (e2e, `app-shell.spec.ts`, iPhone à 320 px) : sur `/import`, les liens « Importer », « Rounds », « Handicaps », « Coups » et « Joueurs » de `getByRole("navigation", { name: "Sections" })` sont tous `toBeInViewport({ ratio: 1 })`, et chacun mesure au moins 44 × 44 px. Mutation : garder `overflow-x-auto` sur une seule ligne en haut.
- [ ] 4.2 TDD (e2e, iPhone) : sur `/handicaps`, faire défiler jusqu'en bas. La boîte du dernier élément de `main` se termine au-dessus du haut de la barre « Sections » (`last.bottom <= nav.top`). Mutation : retirer `padding-bottom: var(--bottom-chrome)` de `<main>`.
- [ ] 4.3 TDD (e2e) : `aria-current`. Sur la page d'un round (`seedRound`), seul « Rounds » porte `aria-current="page"`, dans la nav visible. Sur `/imports/[id]`, c'est « Importer ». Sur `/`, aucun lien ne le porte. Mutation : comparer avec `===` seulement, ce qui fait échouer la sous-page.
- [ ] 4.4 TDD (e2e, projet `chromium`, 1024 px) : `getByRole("navigation", { name: "Sections" })` n'est pas visible, et les 5 liens sont visibles dans « Navigation principale ». Mutation : oublier `md:hidden` sur la barre du bas.
- [ ] 4.5 Implémenter `AppNav` (décision 1), `NavLink` client, les icônes `lucide-react` dans `LINKS`, ainsi que les variables `--tabbar-h` et `--bottom-chrome` dans `globals.css` (décision 2). Vérifier : 4.1 à 4.4 sont verts, `layout-width.spec.ts` et `home.spec.ts` le restent sans modification.

## 5. Zones sûres et barre « Enregistrer » (spec « Zones sûres en plein écran »)

- [ ] 5.1 TDD (e2e, iPhone) :
  - sur la correction d'un import prêt, la barre qui contient « Enregistrer » se termine exactement au haut de la barre « Sections » (`Math.round(save.bottom) === Math.round(nav.top)`) ;
  - `getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom")` n'est pas vide.

  Mutation : laisser `bottom-0` sur la barre « Enregistrer », qui passe alors sous les onglets.
- [ ] 5.2 TDD (e2e, projet `chromium`, 1440 px) : sur la correction, la barre « Enregistrer » a la même largeur que `main` moins ses marges intérieures, soit 1 248 px. Mutation : garder `-mx-4` à toutes les largeurs (largeur de 1 280 px).
- [ ] 5.3 Implémenter `padding-top: var(--safe-top)` sur l'en-tête, `padding-bottom: var(--safe-bottom)` sur la barre d'onglets, ainsi que `bottom: var(--bottom-chrome)` et `max-lg:-mx-4` sur la barre « Enregistrer » (`round-editor.tsx`). Vérifier : 5.1 et 5.2 sont verts.

## 6. Rien de coupé sur téléphone (spec « Pas de défilement horizontal de la page »)

- [ ] 6.1 TDD (e2e) : déplacer `expectNoHorizontalScroll` de `mobile.spec.ts` vers `tests/e2e/fixtures.ts`, puis l'utiliser dans `app-shell.spec.ts` sur la liste littérale des pages de la spec (`/`, `/import`, `/imports/[id]`, `/rounds`, `/rounds/[id]`, `/rounds/[id]/edit`, `/rounds/new`, `/players`, `/handicaps`, `/strokes`), à 320 puis 390 px. Sur `/rounds/new` et `/imports/[id]`, le test ouvre aussi le calendrier, et sur `/rounds/[id]` le dialogue de suppression. Mutation : remettre `[--cell-size:--spacing(11)]` dans `date-field.tsx` (+9 px à 320).
- [ ] 6.2 TDD (e2e, iPhone à 390 px) : sur `/handicaps`, avec un joueur qui a 3 rounds comptés, chaque `getByText("Compte", { exact: true })` visible est `toBeInViewport({ ratio: 1 })`, et il y en a exactement 3. Mutation : laisser la 4e colonne visible sous `md`.
- [ ] 6.3 TDD (e2e, iPhone) : sur `/import`, `getByLabel("Photo de la carte")` existe toujours, et le texte « Choisir une photo » est visible et mesure au moins 44 px. Le parcours de `import-photo.spec.ts` reste vert. Mutation : `display: none` sur le champ, qui ne reçoit alors plus le focus clavier.
- [ ] 6.4 Implémenter les décisions 7, 8 (partie téléphone) et 10, puis le `flex-nowrap` de la liste des imports (décision 9). Vérifier : 6.1 à 6.3 sont verts, et `date-picker.spec.ts` et `camera-capture.spec.ts` le restent.

## 7. Passe ordinateur

- [ ] 7.1 TDD (e2e, `chromium`, 1440 px) :
  - sur la page d'un round, la table du classement net mesure au plus 672 px (`max-w-2xl`) ;
  - sur `/handicaps`, la hauteur de la figure « Courbe de l'index de Gab » est à 8 px près celle de la table « Différentiels de Gab » ;
  - sur `/import`, la date d'un import créé le 17 octobre 2026 à 19:32 s'affiche « 17 octobre 2026, 19:32 ».

  Mutations : oublier `max-w-2xl` ; garder `h-48` fixe ; garder le format `dd/MM/yyyy`. Avant de changer le format, lancer `grep` dans `tests/e2e` sur les assertions qui lisent l'ancien format et les mettre à jour dans la même tâche.
- [ ] 7.2 Implémenter la décision 9 (classement, courbe, dates d'import, carte « Ajouter un joueur » en tête, libellés de Coups). Vérifier : 7.1 est vert, puis relancer le script d'audit (`scratchpad/audit.config.ts`, à recopier dans `tests/e2e/` le temps du contrôle sans le commiter) et comparer les captures 390 et 1440 px de chaque page avec celles d'avant. Joindre à la PR les paires avant/après les plus parlantes.

## 8. Vérification d'ensemble

- [ ] 8.1 Lancer les contrôles du projet : `pnpm check:pins`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm build` et `docker build`. Vérifier : tout est vert.

## 9. Vérification réelle (humain)

- [ ] 9.1 Sur l'iPhone de Manu, après déploiement :
  - supprimer l'ancienne icône d'écran d'accueil si elle existe, puis « Ajouter à l'écran d'accueil » depuis `/login` ;
  - vérifier l'icône drapeau et le nom « Golf » ;
  - à l'ouverture : pas de barre Safari, « ⛳ Golf » sous l'îlot, onglets au-dessus de la barre d'accueil ;
  - sur une correction : « Enregistrer » est entièrement visible au-dessus des onglets ; toucher une liste déroulante ne zoome pas ;
  - noter si les deux barres du bas gênent la saisie (design, risques).

  Sur l'ordinateur, parcourir les cinq sections à 1 440 px.

## Workflow follow-up

- Archiver ce change (`/opsx:archive`) une fois sa PR fusionnée et la vérification 9.1 validée.
