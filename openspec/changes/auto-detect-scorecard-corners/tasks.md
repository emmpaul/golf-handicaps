# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après les specs. Le client Anthropic est un collaborateur simulé ; le code testé tourne réellement. `pnpm jscpd` reste à 0 %, chaque commit passe commitlint, et aucun test n'appelle l'API réelle.

## 1. Fixtures et outillage de calibration

- [ ] 1.1 Demander à l'utilisateur au moins 3 photos réelles de cartes GSPro, dans des conditions différentes : biais marqué, reflet, écran sombre, 4 joueurs si possible. Les réduire comme `IMG_3064` (`sips … -Z 3000`), mesurer leurs coins à la main et les documenter dans `tests/fixtures/scorecards/README.md`, au même format. Vérifier : chaque photo a son `.corners.json`, et `pnpm ocr:debug <photo> <corners>` produit un panneau redressé lisible.
- [ ] 1.2 `scripts/ocr-debug.ts` : le fichier de coins devient facultatif. Sans lui, le script lance la détection locale (groupe 2) et écrit la photo réduite avec les quadrilatères du tableau et du panneau, et les valeurs des contrôles du design §3. Le script appelle la détection, donc il se termine une fois le groupe 2 fait. Vérifier : `pnpm ocr:debug tests/fixtures/scorecards/gspro-img3064.jpg` écrit ces fichiers.

## 2. Détection locale (spec `scorecard-panel-detection`)

- [ ] 2.1 Mesurer `TABLE_RECT` (rectangle du tableau clair dans le panneau redressé) sur la référence avec `pnpm ocr:debug`, et l'ajouter à `src/ocr/layouts/gspro.ts` avec la même convention : pixels du panneau 2400×1224, divisés par sa taille.
- [ ] 2.2 TDD : ajustement de droite robuste et intersection, dans `src/ocr/detect-panel.ts`. Tests sur des points écrits à la main : 20 points sur y = 2x + 1, plus 2 points aberrants, donnent la pente 2 et l'ordonnée 1 à 1e-6 près. Les droites x = 10 et y = 20 se coupent en (10, 20). Mutation qui doit faire rougir : ne pas écarter les points aberrants.
- [ ] 2.3 TDD : `acceptCorners(photo, corners)` (design §3). Coins de la référence : accepté, et le panneau rendu est le même que celui de `rectifyPanel`. Coins concaves (topRight et bottomLeft échangés) : refusé. Quadrilatère de 10 % × 10 % : refusé. Coins qui encadrent le logo IDRA au-dessus du panneau : refusé. Image synthétique uniforme gris 200 de 3000×2250 : refusé. Mutation : retirer le contrôle des lignes de joueur fait passer le cas du logo au vert.
- [ ] 2.4 TDD : `detectPanel(photo)` renvoie `{ corners, panel }` ou `null`. Référence : chaque coin est à moins de 0,01 du coin mesuré à la main, sur chaque axe. Référence tournée de 90° avec l'orientation EXIF 6 (sharp, généré dans le test) : mêmes coins à 0,01 près, une fois ramenés à la photo droite. Image grise uniforme : `null`. Mutation : oublier `rotate()` fait rougir le cas EXIF.
- [ ] 2.5 Étendre le test 2.4 à chaque photo du groupe 1. Ajuster les seuils de §3 et le décalage d'Otsu jusqu'à ce que toutes passent, puis les figer en constantes nommées et commentées. Vérifier : `pnpm test tests/ocr` passe, et la détection de la référence prend moins de 2 s (mesure dans le test).
- [ ] 2.6 `readScorecardPanel` sert de point d'entrée de la lecture à partir d'un panneau déjà redressé. `readScorecard` reste pour `ocr:debug` avec coins. Vérifier : le test de lecture complète de la référence passe à l'identique, et un nouveau test « détection puis lecture » de la référence donne exactement `gspro-img3064.draft.json`.

## 3. Repli IA pour le cadrage (spec `scorecard-panel-detection`, `scorecard-ai-completion`)

- [ ] 3.1 TDD : `AiBudget.canSpend(now, maxCost)`. Avec un plafond de 1 $ et 950 000 micro-dollars dépensés, un appel de pire coût 52 800 est refusé, et un de 40 000 est permis. Adapter l'appel de complétion pour passer `MAX_CALL_COST`. Vérifier : les tests de budget existants restent verts.
- [ ] 3.2 TDD : `MAX_LOCATE_COST` dans `src/ai/pricing.ts`, avec les bornes de tokens du design §4. Vérifier : la valeur attendue est écrite à la main dans le test (52 800 avec 3 200 et 2 000 tokens), à corriger après la mesure de 3.5.
- [ ] 3.3 TDD : `ClaudeCornerLocator`, contre un faux client injecté. La requête contient le modèle `claude-opus-5-5`, l'effort `low`, `max_tokens` 2000, le schéma de sortie, et une seule image JPEG base64. À partir de la référence 3000×2250, l'image fait 1568×1176 et n'a pas d'EXIF (vérifié avec `sharp().metadata()`). Options : `timeout` 60000, `maxRetries` 1. Une réponse valide est parsée en coins ; `found: false` donne `null` ; un `refusal`, un `max_tokens` ou un JSON hors schéma lèvent `AiCompletionError` avec l'usage. Extraire avec `ClaudeDraftCompleter` ce qu'ils partagent (envoi, contrôle de `stop_reason`, parse), pour que `pnpm jscpd` reste à 0.
- [ ] 3.4 TDD : `locatePanel(photo, ai, now)`, cadrage local puis repli. Détection locale réussie : 0 appel. Échec local avec clé : exactement 1 appel, et l'affinage local dans la zone de l'IA donne les coins de la référence à 0,01 près, à partir de coins IA décalés de 0,02. Sans clé : 0 appel, résultat `null`. Plafond atteint : 0 appel, `null`. Erreur de l'API : `null`, et un appel facturé entre dans le cumul pour exactement son coût. Coins de l'IA sur le logo : refusés, résultat `null`.
- [ ] 3.5 Mesurer une fois, à la main et hors des tests, l'usage réel d'un appel de cadrage sur la référence (`ANTHROPIC_API_KEY` locale, petit script jetable non commité). Figer les bornes de tokens dans `src/ai/model.ts` et corriger la valeur attendue de 3.2. Vérifier : `pnpm test tests/ai` passe.

## 4. Données et job (spec `scorecard-import`, `scorecard-panel-detection`)

- [ ] 4.1 Migration `0003` : `imports.corners` nullable et nouvelle colonne `imports.corners_source` (`pnpm db:generate`). Vérifier : le test de migration sur base vide passe, et une base qui contient des imports en `queued`, `ready` et `failed` les garde avec leurs coins après la migration.
- [ ] 4.2 TDD : `createImport` sans coins. L'import est créé avec `corners = null` et son job. `POST /api/imports` avec la seule `photo` répond 201. Un champ `corners` envoyé quand même est ignoré : l'import a `corners = null`. Mettre à jour `tests/app/api/imports.test.ts`.
- [ ] 4.3 TDD : `recropImport`. Un import `ready` sans round est accepté : `queued`, `corners_source = manual`, correction effacée. Un import `ready` avec round, `queued` ou `reading` : `not-recroppable`, et l'import ne change pas. L'API répond 409 « Cet import ne peut pas être recadré ».
- [ ] 4.4 TDD : gestionnaire `ocr-scorecard` (design §5), avec une lecture et une IA simulées. Import sans coins dont la photo est la référence : `corners` enregistrés à 0,01 près, `corners_source = auto`, puis `ready`. Photo grise : `failed` dès la 1re tentative, job `done`, aucun appel IA sans clé. Import avec coins `manual` : aucune détection (espion sur `locatePanel`), lecture avec ces coins. Échec local avec IA simulée qui rend les coins de la référence : `corners_source = ai`. Cadrage IA plus complétion : exactement 2 appels.
- [ ] 4.5 `src/worker.ts` : construire le `CornerLocator` à côté du `DraftCompleter`, sur le même client, et `null` sans clé. Vérifier : `pnpm build:worker` réussit, et `pnpm dev:worker` sans clé démarre sans erreur.

## 5. Interface (spec `scorecard-import`)

- [ ] 5.1 `ImportFlow` : envoi direct après décodage, sans `CropSteps`, avec « Envoi de la photo… » pendant l'envoi. Mettre à jour `tests/e2e/import-photo.spec.ts`, `import-queue.spec.ts` et `camera-capture.spec.ts`. Choisir la référence fait apparaître un import « En attente » sans aucune poignée affichée. 3 photos à la suite donnent 3 imports.
- [ ] 5.2 `ImportList` : « Panneau introuvable sur la photo » pour un import `failed` sans coins. Liens « Vérifier » et « Recadrer la photo » pour un import `ready` sans round. Vérifier : e2e avec un import en base dans chacun de ces états.
- [ ] 5.3 Écran de correction : lien « Recadrer la photo », et note « Cadrage trouvé par l'IA, vérifie la photo » quand `corners_source = ai`. La page `/imports/[id]/recadrer` est ouverte aux imports recadrables, et redirige les autres. Mettre à jour `tests/e2e/recrop.spec.ts` : depuis un import prêt, recadrer avec les coins de la référence ramène l'import « Prêt à vérifier », lu avec ces coins. Les poignées partent des coins enregistrés.
- [ ] 5.4 Retirer le code devenu mort côté envoi (`INITIAL_CORNERS` reste pour le recadrage sans coins). Vérifier : `pnpm lint`, `pnpm typecheck` et `pnpm jscpd` passent sans export inutilisé.

## 6. Documentation et vérification d'ensemble

- [ ] 6.1 README : envoi sans cadrage, repli IA du cadrage, et ce qui part chez Anthropic dans ce cas (photo réduite, sans EXIF) à côté de `ANTHROPIC_API_KEY`. Vérifier : relecture du paragraphe par rapport aux specs.
- [ ] 6.2 Vérification d'ensemble : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm jscpd`, `pnpm e2e`, puis `pnpm e2e:compose`. Ce dernier lance web et worker dans Docker : importer la référence sans cadrage la mène à « Prêt à vérifier » avec le brouillon de référence.

## Workflow follow-up

- Branche `feat/auto-detect-scorecard-corners` depuis `origin/main`, PR, fusion une fois la CI verte (CLAUDE.md).
- Avant le déploiement : sauvegarde du volume, puis web et worker déployés ensemble (design, Migration Plan).
- Archiver le change après fusion avec `/opsx:archive`.
