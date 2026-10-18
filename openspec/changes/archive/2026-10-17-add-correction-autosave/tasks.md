# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après les specs. Chaque tâche nomme la mutation qui fait passer son test au rouge. Les données partent du brouillon de référence `tests/fixtures/scorecards/gspro-img3064.draft.json` (ligne 1 « GAB », ligne 2 « MANU », date 2026-10-17, Manu trou 1 = 7, Gab trou 9 = 5). Le code testé tourne réellement ; seuls `fetch` et les minuteries sont simulés dans les tests du hook. `pnpm jscpd` reste à 0 %, et chaque commit passe commitlint.

## 1. Base

- [x] 1.1 Ajouter `correction` (JSON, nullable) à `imports` dans `src/db/schema.ts`, puis générer `drizzle/0002_correction_autosave.sql` avec `pnpm db:generate`. Test de migration : sur base vide, `PRAGMA table_info(imports)` contient `correction` ; une base migrée jusqu'à `0001` avec un import garde cet import, avec `correction` à `null`. Mutation : retirer la ligne `ALTER TABLE` du SQL. Vérifier : `pnpm test tests/db` passe.

## 2. Format enregistré (spec « Sauvegarde automatique de la correction d'un import »)

- [x] 2.1 Déplacer `value`, `holeRow` et le schéma de la carte de `src/server/rounds/http.ts` vers `src/scorecard/form-schema.ts`, sans changer `postRound`. Vérifier : les tests existants de `POST /api/rounds` et `PUT /api/rounds/[id]` restent verts, et `pnpm jscpd` sort à 0.
- [x] 2.2 TDD : `savedCorrectionSchema` dans `src/scorecard/form-schema.ts`. Cas :
  - la correction tirée du brouillon de référence passe ;
  - `version: 2` est refusée ;
  - 5 lignes sont refusées (`MAX_LINES` vaut 4) ;
  - `playedOn: "13/10/2026"` est refusée.

  Mutation : accepter n'importe quelle `version`.
- [x] 2.3 TDD : `toSavedCorrection(state)` et `restoreEditorState(saved, players)` dans `form-state.ts`. Cas :
  - aller-retour d'un état où la ligne 1 est associée à Gab, Manu trou 1 vaut 6, la date vaut `"2026-10-13"` et `aiCells` vaut `["player0:9"]` : on retrouve exactement ces valeurs ;
  - `readTotals` et `readCardTotals` à `true` sont gardés, et un OUT lu de 38 reste 38 même si la somme des trous vaut 36 ;
  - les `key` des lignes ne sont pas enregistrées, et deux lignes restaurées ont des `key` différentes ;
  - un `playerId` 999 absent de la liste des joueurs revient à `null`.

  Mutation : ne pas enregistrer `playerId`, ou recalculer les totaux à la reprise.

## 3. Route `PUT /api/imports/[id]/correction` (spec « Correction refusée hors vérification »)

- [x] 3.1 TDD : `saveCorrection(db, id, raw)` dans `src/server/imports/correction.ts`. Cas :
  - import « Prêt à vérifier » : `ok`, et `imports.correction` vaut la correction envoyée tandis que `imports.draft` reste égal au brouillon de référence ;
  - import en « Échec » sans brouillon : `ok` ;
  - import « En attente », puis « Lecture en cours » : refus « Lecture en cours », `correction` reste `null` ;
  - import lié à un round : refus « Cette carte est déjà enregistrée », `correction` inchangée ;
  - identifiant 999, puis `abc` : « Import introuvable » ;
  - corps où `players` remplace `lines` : « Requête invalide ».

  Mutation : retirer `round_id IS NULL` de la condition de l'`UPDATE`.
- [x] 3.2 Route `src/app/api/imports/[id]/correction/route.ts` qui traduit le résultat en 204, 400, 404 ou 409 avec `{ error }`. Test de route : les codes et les messages exacts de la décision 3 du design, et 401 sans session (via le proxy). Mutation : renvoyer 400 au lieu de 409 pour un import lié à un round.

## 4. Reprise à l'ouverture (spec « Reprise de la correction enregistrée »)

- [x] 4.1 TDD : `initialEditorState(db, row, today)` dans `src/server/imports/correction.ts`, puis l'utiliser dans `src/app/(app)/imports/[id]/page.tsx`. Cas :
  - correction valide avec la date `"2026-10-13"` : l'état a cette date, pas `"2026-10-17"` ;
  - correction avec `version: 2` : l'état vient du brouillon, date `"2026-10-17"`, ligne 1 associée à Gab par l'alias « GAB » ;
  - import en « Échec » sans brouillon ni correction, `today` = `"2026-10-17"` : l'écran vide daté `"2026-10-17"`.

  Mutation : lire `draft` avant `correction`.

## 5. Sauvegarde différée et indicateur (specs « Sauvegarde automatique… » et « Indicateur d'enregistrement »)

- [x] 5.1 TDD : `useCorrectionAutosave(importId, state)` dans `src/components/round-editor/autosave.ts`, testé avec de fausses minuteries et un faux `fetch`. Cas :
  - premier rendu sans modification : 0 appel, statut vide ;
  - trois modifications à 300 ms d'écart : 1 seul `PUT` vers `/api/imports/7/correction`, 1 000 ms après la dernière, avec le dernier état ;
  - réponse 204 : statut « Enregistrement… » puis « Enregistré » ;
  - `fetch` qui rejette : « Modifications non enregistrées », puis un nouvel envoi 5 000 ms plus tard ;
  - réponse 409 `{ error: "Cette carte est déjà enregistrée" }` : ce message, et aucun envoi après une nouvelle modification ;
  - `visibilitychange` vers `hidden` avec un envoi en attente : `PUT` immédiat avec `keepalive: true`.

  Mutation : déclencher l'envoi à chaque modification sans délai, ou omettre `keepalive`.
- [x] 5.2 Brancher le hook dans `RoundEditor` pour `target.kind === "create"` avec un `importId`, et afficher le statut dans un `<p role="status">` de la barre du bas. `submit` met en pause, puis reprend si le round n'est pas enregistré. Vérifier : sur `/rounds/new`, aucune requête vers `/api/imports` (test e2e en 7.1), et les e2e existants de saisie manuelle et de correction d'un round restent verts.

## 6. Recadrage (spec « Nouvelle lecture après recadrage »)

- [x] 6.1 TDD : `recropImport` met `correction` à `null` dans sa transaction. Test : un import en « Échec » avec une correction datée `"2026-10-13"`, recadré, a `correction` à `null` et le statut « En attente ». Mutation : retirer `correction: null` du `set`.
- [x] 6.2 La page `/imports/[id]/recadrer` passe `hasCorrection` à `RecropImport`, qui affiche « Recadrer relance la lecture et remplace tes corrections ». Test e2e : visible pour un import en « Échec » avec correction, absent sans correction. Mutation : afficher l'avertissement sans condition.

## 7. Rechargement de bout en bout (toutes les exigences de la spec)

- [x] 7.1 TDD (e2e) : `tests/e2e/correction-autosave.spec.ts`, ajouté à `MOBILE_SPECS` dans `playwright.config.ts` pour tourner aussi sur WebKit iPhone. Données : `seedReadyImport` avec le brouillon de référence dont la ligne 1 est lue « JULIEN ». Cas :
  - associer la ligne 1 à Gab, remplacer Manu trou 1 (7) par 6, attendre « Enregistré », recharger : ligne 1 = Gab, Manu trou 1 = 6 ;
  - remplacer la date par 2026-10-13, attendre « Enregistré », recharger : 2026-10-13 ;
  - import avec `aiCells = ["player0:9"]` : remplacer Gab trou 9 par 4, attendre « Enregistré », recharger : la case vaut 4 et aucune case ne porte « complété par l'IA » ;
  - remplacer Gab trou 9 par 4 puis fermer la page tout de suite (`page.close({ runBeforeUnload: true })`), rouvrir l'import dans une nouvelle page : la case vaut 4 ;
  - deuxième contexte de navigateur (autre appareil) : associer la ligne 2 à Sean dans le premier, attendre « Enregistré », ouvrir l'import dans le second : ligne 2 = Sean ;
  - enregistrer le round depuis un contexte, puis modifier une case dans l'autre : « Cette carte est déjà enregistrée » ;
  - `/rounds/new` : modifier une case n'envoie aucune requête vers `/api/imports`.

  Vérifier : `pnpm e2e` passe sur Chromium et WebKit iPhone.

## 8. Vérification d'ensemble

- [ ] 8.1 Passer les contrôles du projet : `pnpm check:pins`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm build`, `docker build`. Vérifier : tout est vert, et `grep -rn "localStorage" src/components/round-editor` ne trouve rien.

## 9. Vérification réelle (humain)

- [ ] 9.1 Sur le téléphone de Manu, après déploiement : corriger un import (un joueur choisi, une case, la date), passer à une autre appli, revenir et recharger, puis ouvrir le même import sur l'ordinateur. Vérifier que les trois corrections sont là aux deux endroits.

## Workflow follow-up

- Fusionner #7 (`add-ai-vision-fallback`) avant d'ouvrir la PR de ce change, puis rebaser cette branche sur `origin/main`.
- Archiver `add-golf-handicap-tracker`, puis `add-ai-vision-fallback`, avant d'archiver ce change : les specs `scorecard-import` et `scorecard-ai-completion` modifiées ici doivent déjà exister dans `openspec/specs/`.
- Archiver ce change (`/opsx:archive`) une fois sa propre PR fusionnée et la vérification 9.1 validée.
