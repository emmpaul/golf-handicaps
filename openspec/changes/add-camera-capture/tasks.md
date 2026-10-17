# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après la spec. Chaque tâche nomme la mutation qui fait passer son test au rouge. Les données partent de la photo de référence `tests/fixtures/scorecards/gspro-img3064.jpg`. `pnpm jscpd` reste à 0 %, et chaque commit passe commitlint.

## 1. Fonction de choix partagée

- [x] 1.1 Extraire `pickFrom(event)` dans `import-flow.tsx` (lit `files?.[0]`, appelle `choose`, vide `value`) et l'utiliser pour « Photo de la carte ». Vérifier : `import-photo.spec.ts` et `correction.spec.ts` restent verts, sans modification.

## 2. Bouton « Prendre une photo » (spec « Prise de photo depuis l'app »)

- [x] 2.1 Avant d'écrire le test : dans le projet `webkit-iphone`, `page.evaluate(() => matchMedia("(pointer: coarse)").matches)` vaut-il `true` ? Noter le résultat dans la PR. Si `false`, les cas de visibilité de 2.2 passent dans un contexte Chromium `{ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 } }` (design, risques).
- [x] 2.2 TDD (e2e, `tests/e2e/camera-capture.spec.ts`, ajouté à `MOBILE_SPECS` dans `playwright.config.ts`) : sur `/import` avec pointeur grossier. Cas :
  - `getByLabel("Prendre une photo")` existe, a `capture="environment"` et `accept="image/*"` ;
  - le libellé « Prendre une photo » est visible et mesure au moins 44 px de haut ;
  - `getByLabel("Photo de la carte")` est toujours là et n'a pas d'attribut `capture`.

  Mutation : mettre `capture` sur « Photo de la carte » au lieu d'un deuxième champ, ou oublier `capture`.
- [x] 2.3 TDD (e2e) : même parcours qu'un fichier choisi. `setInputFiles(REFERENCE_PHOTO)` sur « Prendre une photo » : « Carte à cadrer » est visible ; avec un faux fichier `IMG_3064.DNG` illisible : « Format de photo non lisible, exporte-la en JPEG ». Mutation : brancher le champ caméra sur un `onChange` qui n'appelle pas `choose`.
- [x] 2.4 TDD (e2e) : annulation. `setInputFiles([])` sur « Prendre une photo » : aucune alerte dans `main`, pas de « Carte à cadrer ». Mutation : afficher `UnreadablePhoto` quand aucun fichier n'est reçu.
- [x] 2.5 TDD (e2e, projet `chromium`, bureau) : sur `/import`, « Prendre une photo » n'est pas visible (`toBeHidden`) et « Photo de la carte » l'est. Mutation : retirer `hidden` (bouton visible partout).

## 3. Accessibilité

- [x] 3.1 TDD (e2e) : au clavier (Chromium avec `hasTouch`), Tab atteint le champ « Prendre une photo » et son contour de focus est visible sur le libellé (`focus-within`). Mutation : `display: none` sur le champ au lieu de `sr-only` (le focus saute le bouton).

## 4. Vérification d'ensemble

- [x] 4.1 Passer les contrôles du projet : `pnpm check:pins`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm build`, `docker build`. Vérifier : tout est vert, et `grep -rn "getUserMedia" src` ne trouve rien.

## 5. Vérification réelle (humain)

- [ ] 5.1 Sur l'iPhone de Manu, après déploiement : toucher « Prendre une photo », vérifier que l'appareil photo arrière s'ouvre directement, photographier l'écran du simulateur en portrait puis en paysage, et vérifier que l'écran de cadrage montre la photo dans le bon sens. Annuler une prise de vue : l'écran ne change pas. Puis importer une photo de la photothèque par « Photo de la carte ». Sur l'ordinateur, vérifier que « Prendre une photo » n'apparaît pas.

## Workflow follow-up

- Archiver `add-golf-handicap-tracker` avant d'archiver ce change : la spec `scorecard-import` doit déjà exister dans `openspec/specs/`.
- Archiver ce change (`/opsx:archive`) une fois sa PR fusionnée et la vérification 5.1 validée.
