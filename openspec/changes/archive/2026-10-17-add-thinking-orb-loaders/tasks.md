# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après la spec (textes exacts : « Préparation de la photo… », « Redressement de la photo… », « Envoi de la photo… », « Enregistrement du round… », « Création du joueur… », « Connexion… », « Enregistrement du joueur… », « Suppression du round… »). Chaque tâche nomme la mutation qui fait passer son test au rouge. Les attentes s'observent en e2e en retardant la réponse avec `page.route` (1 000 ms), jamais avec un `waitForTimeout` seul. `pnpm jscpd` reste à 0 %, et chaque commit passe commitlint.

## 1. Dépendance

- [x] 1.1 `pnpm add thinking-orbs@0.3.2`. Vérifier : `package.json` contient `"thinking-orbs": "0.3.2"` sans `^`, `pnpm check:pins` affiche « Toutes les versions sont exactes. », et `pnpm build` passe.

## 2. Composant d'attente (spec « Indicateur d'attente », « Mouvement réduit »)

- [x] 2.1 TDD : `orbForImport(status)` et la table `ORB_FOR` dans `src/components/ui/pending.tsx`. Cas : `queued` → `"breathing"`, `reading` → `"searching"`, `ready` → `null`, `failed` → `null` ; `ORB_FOR.rectify` → `"shaping"`, `ORB_FOR.send` → `"working"`. Mutation : renvoyer une animation pour `ready`.
- [x] 2.2 `Pending` (`role="status"`, orbe `aria-hidden`, texte visible) et `PendingOrb` (orbe seule, `aria-hidden`), `"use client"`, `size={20}`, `theme="light"`. Seul fichier qui importe `thinking-orbs`. Vérifier : `grep -rln "thinking-orbs" src` ne renvoie que `src/components/ui/pending.tsx`. Couvert en e2e par 3.1.

## 3. Import d'une photo (spec « Attentes de l'import d'une photo »)

- [x] 3.1 TDD (e2e, `tests/e2e/loading.spec.ts`) : envoi. `POST /api/imports` retardé de 1 000 ms ; après « Lancer la lecture », `getByRole("status")` a le texte « Envoi de la photo… », le `<canvas>` qu'il contient a `aria-hidden="true"`, puis l'indicateur disparaît et « Lecture en file d'attente. Tu peux envoyer la photo suivante. » s'affiche. Mutation : ne pas afficher `Pending` pendant `busy === "send"`. Ce test est ignoré sur `webkit-iphone` : sous WebKit, une requête interceptée par `page.route` perd la partie Blob du corps multipart.
- [x] 3.2 TDD (e2e) : redressement. `CropSteps` passe `busy` à `"rectify" | "send" | null`. Sur l'écran de recadrage d'un import `seedFailedImport`, `page.addInitScript` remplace `window.Image` pour que les images créées par `new Image()` (seul `rectifyPreview` le fait ; l'éditeur de coins est un `<img>` JSX) reçoivent leur `src` 1 000 ms plus tard. Un `page.route` retardé ne suffit pas : Chromium sert la seconde image depuis son cache mémoire sans nouvelle requête. Après « Valider le cadrage », « Redressement de la photo… » est visible et « Valider le cadrage » est désactivé, puis « Carte redressée » remplace l'indicateur. Mutation : afficher « Envoi de la photo… » pour les deux attentes.
- [x] 3.3 TDD (e2e) : préparation. `ImportFlow` passe par un état `preparing` pendant `decodePhoto`. Avec une photo de 4000 × 3000 générée par `sharp` (comme `import-photo.spec.ts`) et `createImageBitmap` ralenti par `page.addInitScript` (attente de 1 000 ms avant l'appel d'origine), « Préparation de la photo… » est visible, puis « Carte à cadrer » le remplace. Mutation : passer directement à `crop` sans état `preparing`.
- [x] 3.4 TDD (e2e) : recadrage. Sur `/imports/[id]/recadrer` d'un import `seedFailedImport`, `POST /api/imports/[id]/corners` retardé de 1 000 ms : « Envoi de la photo… » visible après « Lancer la lecture ». Mutation : `RecropImport` passe une `onLaunch` qui ne renvoie pas la promesse de l'envoi.

## 4. Liste des imports (spec « Imports en attente de lecture »)

- [x] 4.1 Helper e2e `seedQueuedImport(status)` dans `tests/e2e/data.ts` : un import `queued` ou `reading` sans job, que le worker ne touche donc pas. Vérifier : l'import reste « En attente » 5 s après l'ouverture de `/import`.
- [x] 4.2 TDD (e2e) : `PendingOrb` devant le badge quand `orbForImport(status)` n'est pas `null`. Données : un import `reading` et un import `seedReadyImport`. Cas : la ligne « Lecture en cours » contient un `<canvas aria-hidden="true">`, la ligne « Prêt à vérifier » n'en contient pas ; passer l'import à `ready` en base, attendre « Prêt à vérifier » sur sa ligne : le `<canvas>` a disparu. Mutation : afficher l'orbe pour tous les imports.

## 5. Écran de correction (spec « Attentes de l'écran de correction »)

- [x] 5.1 TDD (e2e) : enregistrement du round. `POST /api/rounds` retardé de 1 000 ms sur l'import `seedReadyImport` ; après « Enregistrer », `getByRole("status")` affiche « Enregistrement du round… » et reste affiché jusqu'à l'URL `/rounds` ; le bouton reste désactivé pendant ce temps. `submit` ne remet `saving` à `false` que sur doublon ou erreur. Mutation : remettre `saving` à `false` dans `finally` (le bouton redevient actif avant la navigation).
- [x] 5.2 TDD (e2e) : création d'un joueur. Action serveur retardée en interceptant la requête POST de la page (`page.route` sur l'URL de l'import, en-tête `next-action`) ; « Création du joueur… » visible à côté de la ligne 1, puis la ligne 1 associée à « Julien ». Mutation : ne pas afficher `Pending` quand `pending` est vrai.
- [x] 5.3 Si `add-correction-autosave` est fusionné avant ce change : son indicateur affiche `PendingOrb` devant « Enregistrement… », et rien devant « Enregistré » ni « Modifications non enregistrées ». Vérifier : un test e2e de `correction-autosave.spec.ts` contrôle la présence du `<canvas>` pendant « Enregistrement… » seulement. Sinon, noter ce point dans la PR de `add-correction-autosave`.

## 6. Autres attentes (spec « Autres attentes de l'app »)

- [x] 6.1 TDD (e2e) : connexion, joueurs, suppression. Retard de 1 000 ms sur les POST de connexion et d'ajout de joueur (actions serveur, en-tête `next-action`) et sur le `DELETE /api/rounds/[id]` de la suppression, puis texte exact visible dans un `role="status"` : « Connexion… » sur `/login`, « Enregistrement du joueur… » à l'ajout de « Julien » sur `/players`, « Suppression du round… » dans la boîte de confirmation d'un round `seedRound`. Mutation : ne brancher `Pending` que sur le formulaire de connexion.

## 7. Mouvement réduit (spec « Mouvement réduit »)

- [x] 7.1 TDD (e2e) : sur la liste avec un import `reading`, sans émulation deux `canvas.toDataURL()` à 300 ms d'écart diffèrent ; avec `page.emulateMedia({ reducedMotion: "reduce" })` et rechargement, ils sont égaux, et « Lecture en cours » reste affiché. Mutation : `PendingOrb` change son `state` toutes les 100 ms (`useState`/`setInterval`), ce qui redessine le canvas malgré le mouvement réduit. Ajouter `loading` à `MOBILE_SPECS` dans `playwright.config.ts`. Vérifier : `pnpm e2e` passe sur Chromium et WebKit iPhone.

## 8. Vérification d'ensemble

- [x] 8.1 Passer les contrôles du projet : `pnpm check:pins`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm build`, `docker build`. Vérifier : tout est vert.

## 9. Vérification réelle (humain)

- [ ] 9.1 Sur le téléphone de Manu, après déploiement : choisir une photo, cadrer, lancer la lecture, suivre l'import jusqu'à « Prêt à vérifier », enregistrer le round. Vérifier qu'une orbe accompagne chaque attente, lisible sur fond clair même avec le téléphone en mode sombre, puis activer « Réduire les animations » et vérifier que l'orbe est immobile.

## Workflow follow-up

- Archiver ce change (`/opsx:archive`) une fois sa PR fusionnée et la vérification 9.1 validée. Il crée la spec `loading-feedback` et ne dépend d'aucun autre archivage.
