# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après les specs. Chaque test nomme la mutation qui le fait rougir. `pnpm jscpd` reste à 0 %, et chaque commit passe commitlint.

## 1. Suppression d'un import, côté serveur (spec `scorecard-import`)

- [ ] 1.1 TDD : `removeUnreferencedPhoto(db, dataDir, photoPath)` (design §3), dans `src/jobs/imports.ts` ou un module voisin. Fichier sans aucune ligne qui le référence : effacé. Fichier encore porté par un round : gardé. Fichier déjà absent : aucune erreur. Mutation : supprimer le contrôle des références efface le fichier du round.
- [ ] 1.2 TDD : `deleteImport(db, id)` (design §1 et §2), dans `tests/jobs/imports.test.ts`. Import `failed` : ligne supprimée, résultat `"deleted"` avec son `photoPath`. Import `queued` : ligne et job `queued` supprimés, et le job d'un autre import reste. Import `ready` avec correction : supprimé. Import `reading` : `"reading"`, ligne et job intacts. Import lié à un round : `"already-saved"`, rien ne change. Id absent : `"not-found"`. Mutations : oublier de supprimer le job laisse 1 job `queued` ; tester `status` avant `round_id` ne change rien ici, mais retirer le test de `round_id` fait passer l'import lié à `"deleted"`.
- [ ] 1.3 TDD : le gestionnaire `ocr-scorecard` sur un import absent (job `running` réservé avant la suppression, design §2). `run` rejette « Import introuvable : <id> », `onFailed` n'écrit aucune ligne `imports`. Vérifier dans `tests/jobs/ocr-scorecard.test.ts`.
- [ ] 1.4 TDD : `DELETE /api/imports/[id]` (design §5), dans `tests/app/api/imports.test.ts`. 204 sans corps, ligne supprimée et fichier photo absent de `DATA_DIR/uploads`. 404 « Import introuvable » pour `404` et pour `abc`. 409 « Lecture en cours » pour un import `reading`. 409 « Cette carte est déjà enregistrée » pour un import lié à un round, avec la photo toujours présente. Partager la table des messages avec `correction/route.ts` ; vérifier `pnpm jscpd`.

## 2. Suppression d'un round importé (spec `rounds`)

- [ ] 2.1 TDD : `deleteRound` supprime les imports du round dans sa transaction et renvoie la photo du round (design §4), dans `tests/server/rounds/edit.test.ts`. Round enregistré depuis un import : plus aucune ligne `imports` pour ce round, et l'import n'apparaît plus dans `listImports`. Round saisi à la main : `listImports` inchangé, avec un autre import présent. Le test existant (index recalculés) reste vert. Mutation : ne pas supprimer l'import le laisse dans `listImports` avec `roundId: null`.
- [ ] 2.2 TDD : `deleteRoundRequest(db, dataDir, id)` efface la photo après la transaction, via `removeUnreferencedPhoto`. Dans `tests/server/rounds/http.test.ts` : 204, puis le fichier n'existe plus. La route `src/app/api/rounds/[id]/route.ts` passe `getEnv().DATA_DIR`. Vérifier : le test « DELETE → 404 » existant reste vert.
- [ ] 2.3 Dialogue de `DeleteRound` : nouvelle description (design §4). Mettre à jour `tests/e2e/rounds.spec.ts` : après la suppression d'un round importé, `/import` ne liste plus son import. Vérifier : `pnpm e2e tests/e2e/rounds.spec.ts`.

## 3. Interface de la liste des imports (spec `scorecard-import`)

- [ ] 3.1 `DeleteImport` et son branchement dans `ImportAction` (design §6). Nouveau `tests/e2e/delete-import.spec.ts`, avec des imports en base : un import en « Échec » supprimé et confirmé disparaît de la liste, et `GET /api/imports/<id>/photo` répond 404. Un import supprimé puis « Annuler » reste. « Supprimer » est présent sur les imports « En attente », « Prêt à vérifier » et « Échec » sans round, et absent sur un import « Lecture en cours » et sur un import lié à un round (comptes exacts sur une liste de 5 imports). Mutation : afficher le bouton pour tout import sans round fait rougir le cas « Lecture en cours ».
- [ ] 3.2 Sur un 409 (import passé en lecture entre-temps), le dialogue se ferme et la liste se recharge. Vérifier : e2e qui passe l'import en `reading` en base avant de confirmer, puis voit le badge « Lecture en cours » et l'import toujours listé.
- [ ] 3.3 Vérifier sur téléphone (`tests/e2e/mobile.spec.ts`, projet mobile) : le bouton « Supprimer » ne fait pas déborder la ligne d'import à 375 px (pas de défilement horizontal).

## 4. Retrait d'un alias (spec `players`)

- [ ] 4.1 TDD : `removeAlias(db, playerId, alias)` (design §7), dans `tests/server/players/aliases.test.ts`. Retirer « seanp » de Manu, qui a l'alias « SEANP » : `findPlayerForName(db, "SEANP")` ne renvoie plus Manu. Le même alias porté par un autre joueur n'est pas touché (`playerId` respecté). Alias absent : aucune erreur, aucune ligne supprimée. Mutation : ignorer `playerId` supprime l'alias de l'autre joueur.
- [ ] 4.2 `removeAliasAction` et liste des alias avec « Retirer » sur la page Joueurs. Mettre à jour `tests/e2e/players.spec.ts` (assertions de texte sur `player-aliases`) et ajouter : retirer « SEANP » de Sean le retire de la liste, et Sean affiche « — » s'il n'en a plus. Vérifier : `pnpm e2e tests/e2e/players.spec.ts`.
- [ ] 4.3 Scénario « Alias réappris » : e2e qui retire un alias, puis associe à la main une ligne de ce nom à un autre joueur et enregistre ; l'alias apparaît chez le nouveau joueur.

## 5. Intégration

- [ ] 5.1 Vérifier : `pnpm lint`, `pnpm typecheck`, `pnpm jscpd`, `pnpm test` et `pnpm e2e` passent ; `openspec validate delete-imports --strict` passe.
