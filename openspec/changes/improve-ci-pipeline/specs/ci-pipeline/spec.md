# Spec Delta

## Purpose

Définit ce que l'intégration continue garantit sur les pull requests et sur `main` : quels contrôles tournent selon les fichiers modifiés, quand une PR reste fusionnable, et comment l'image de release est publiée.

## ADDED Requirements

### Requirement: Changement de documentation seule
Une PR dont tous les fichiers modifiés sont de la documentation SHALL lancer seulement commitlint, `check:pins` et le lint. Elle MUST sauter les tests unitaires, le typecheck, jscpd et les e2e. Sont de la documentation : tout fichier sous `openspec/` ou `docs/`, tout fichier `*.md`, `.release-please-manifest.json`, et `package.json` quand seul son champ `version` change.

#### Scenario: PR qui ne touche que openspec
- **WHEN** une PR ne modifie que `openspec/changes/x/tasks.md` et `openspec/changes/x/design.md`
- **THEN** le job `checks / e2e` est sauté, le job `checks / quality` lance commitlint, `check:pins` et le lint sans lancer `pnpm test`, et l'exécution finit en moins de 2 min

#### Scenario: PR qui touche README et CLAUDE.md
- **WHEN** une PR ne modifie que `README.md` et `CLAUDE.md`
- **THEN** le job `checks / e2e` est sauté

### Requirement: PR de release traitée comme documentation
Une PR qui ne modifie que `CHANGELOG.md`, `.release-please-manifest.json` et le champ `version` de `package.json` SHALL être traitée comme un changement de documentation. Tout autre changement de `package.json`, même accompagné d'un changement de version, MUST lancer la suite complète.

#### Scenario: PR de release
- **WHEN** release-please ouvre ou met à jour sa PR, qui passe `version` de `0.2.0` à `0.3.0` dans `package.json` et `.release-please-manifest.json` et ajoute une section à `CHANGELOG.md`
- **THEN** le job `checks / e2e` est sauté et `checks / quality` ne lance pas `pnpm test`

#### Scenario: Version et dépendance dans le même commit
- **WHEN** une PR change `version` et la version de `zod` dans `package.json`
- **THEN** la suite complète tourne

#### Scenario: Script modifié
- **WHEN** une PR ne change que le script `test` dans `package.json`
- **THEN** la suite complète tourne

### Requirement: Suite complète pour tout changement de code
Une PR ou un push sur `main` qui modifie au moins un fichier qui n'est pas de la documentation SHALL lancer tous les contrôles d'aujourd'hui : commitlint, `check:pins`, lint, typecheck, tests unitaires, jscpd, e2e et, sur `main`, le build Docker et le test de fumée compose.

#### Scenario: Un fichier de code parmi des fichiers de documentation
- **WHEN** une PR modifie `openspec/changes/x/tasks.md` et `src/lib/env.ts`
- **THEN** les jobs `checks / quality` et `checks / e2e` lancent toutes leurs étapes

#### Scenario: Changement de workflow
- **WHEN** une PR ne modifie que `.github/workflows/checks.yml`
- **THEN** la suite complète tourne

#### Scenario: Changement de lockfile
- **WHEN** une PR ne modifie que `pnpm-lock.yaml`
- **THEN** la suite complète tourne

### Requirement: Repli sur la suite complète
Quand la CI ne parvient pas à classer un changement, elle SHALL lancer la suite complète. Un contrôle requis MUST NOT finir réussi ou sauté sans que ses étapes aient tourné, sauf quand le changement a été classé comme documentation.

#### Scenario: Classement en échec
- **WHEN** l'étape qui classe les fichiers modifiés échoue sur une PR
- **THEN** `checks / quality` lance toutes ses étapes, les e2e tournent, et `checks / e2e` finit en échec

#### Scenario: Premier push d'une branche
- **WHEN** le commit précédent n'est pas connu (premier push)
- **THEN** la suite complète tourne

### Requirement: Push de documentation ou de release sur main
Un push sur `main` classé comme documentation SHALL sauter les étapes lourdes de `checks / quality`, les e2e, le build Docker et le test de fumée compose, seulement si l'exécution du workflow `main` du commit parent a réussi. Sinon il MUST lancer la suite complète. Le classement se fait sur les fichiers modifiés et le contenu de `package.json`, jamais sur le sujet du commit.

#### Scenario: Fusion de la PR de release
- **WHEN** la PR de release `0.3.0` est fusionnée sur `main` et que l'exécution `main` du commit parent a réussi
- **THEN** `checks / e2e` et `checks / docker` sont sautés, `release-please` crée le tag `v0.3.0`, et `publish` pousse l'image `v0.3.0`

#### Scenario: Push de documentation après un push rouge
- **WHEN** un commit qui ne modifie que `openspec/` arrive sur `main` et que l'exécution `main` du commit parent a échoué ou a été annulée
- **THEN** la suite complète tourne, build Docker et test de fumée compris

#### Scenario: Sujet de release sur un commit de code
- **WHEN** un commit intitulé `chore(main): release 0.3.0` qui modifie `src/lib/env.ts` arrive sur `main`
- **THEN** la suite complète tourne

### Requirement: PR fusionnable quand des jobs sont sautés
Les contrôles requis par la protection de `main`, `checks / quality` et `checks / e2e`, SHALL toujours rendre un résultat sur une PR, y compris quand ses jobs lourds sont sautés. Une PR de documentation seule dont les contrôles légers passent MUST être fusionnable sans contournement par un administrateur.

#### Scenario: PR de documentation fusionnable
- **WHEN** une PR ne modifie que `openspec/` et que commitlint passe
- **THEN** `checks / quality` est réussi, `checks / e2e` est sauté, et le bouton de fusion est disponible

#### Scenario: Commit mal formé sur une PR de documentation
- **WHEN** une PR ne modifie que `openspec/` avec un commit `bad message`
- **THEN** `checks / quality` échoue sur commitlint et la PR n'est pas fusionnable

### Requirement: E2e répartis sur trois machines
Les e2e d'une PR ou d'un push de code SHALL tourner en trois tranches, chacune sur sa propre machine avec son serveur et sa base. Chaque test des projets Chromium et WebKit iPhone MUST tourner exactement une fois en tout, toutes tranches confondues. Le contrôle `checks / e2e` réunit toutes les tranches : il réussit si toutes réussissent, échoue si l'une échoue ou est annulée, et est sauté pour un changement de documentation.

#### Scenario: Trois tranches vertes
- **WHEN** une PR modifie `src/` et que les trois tranches passent
- **THEN** `checks / e2e-shard (1)`, `checks / e2e-shard (2)`, `checks / e2e-shard (3)` et `checks / e2e` sont réussis, et la somme des tests passés des trois tranches vaut le nombre de tests de `pnpm exec playwright test --list`

#### Scenario: Une tranche rouge
- **WHEN** un test e2e échoue dans la tranche 3
- **THEN** `checks / e2e` finit en échec et la PR n'est pas fusionnable

#### Scenario: Documentation seule
- **WHEN** une PR ne modifie que `openspec/`
- **THEN** les tranches et `checks / e2e` sont sautés

### Requirement: Exécutions remplacées annulées
Un nouveau push sur une PR SHALL annuler l'exécution en cours de cette PR. Sur `main`, une exécution en cours MUST aller à son terme, pour ne jamais couper release-please ou la publication d'une image.

#### Scenario: Deux pushes rapprochés sur une PR
- **WHEN** deux commits sont poussés sur la même PR à 15 s d'écart
- **THEN** l'exécution du premier commit finit « cancelled » et seule celle du second va au bout

#### Scenario: Deux pushes rapprochés sur main
- **WHEN** deux PR sont fusionnées sur `main` à 30 s d'écart
- **THEN** l'exécution de la première va à son terme, et celle de la seconde attend puis tourne

### Requirement: Publication multi-arch native
À la création d'une release, l'image SHALL être publiée sous `vX.Y.Z`, `latest` et le SHA du commit, avec un manifeste qui contient `linux/amd64` et `linux/arm64`. Chaque architecture MUST être construite sur un runner de cette architecture, sans émulation.

#### Scenario: Release publiée pour deux architectures
- **WHEN** la PR de release `vX.Y.Z` est fusionnée
- **THEN** `docker buildx imagetools inspect ghcr.io/<owner>/golf-handicaps:vX.Y.Z` liste `linux/amd64` et `linux/arm64`, et les tags `latest` et le SHA pointent sur le même digest

#### Scenario: Image arm64 utilisable
- **WHEN** on lance `docker run --rm --platform linux/arm64 ghcr.io/<owner>/golf-handicaps:vX.Y.Z node -e 'require("better-sqlite3"); require("sharp")'` sur un hôte arm64
- **THEN** la commande sort en code 0

### Requirement: Tests e2e instables signalés
Un test e2e qui échoue puis passe à la nouvelle tentative SHALL laisser l'exécution verte et apparaître comme instable, avec son nom, dans le résumé de l'exécution GitHub.

#### Scenario: Test e2e instable
- **WHEN** un test e2e échoue au premier essai et passe au second
- **THEN** l'exécution est réussie et son résumé nomme le test comme instable

### Requirement: Délai des tests unitaires qui lancent Tesseract
Un test unitaire qui lance le binaire Tesseract MUST NOT échouer par dépassement du délai par défaut de 5 s de Vitest.

#### Scenario: Lecture Tesseract sur un runner lent
- **WHEN** la lecture de la case INDEX du trou 2 par le binaire Tesseract prend 6 s
- **THEN** le test passe
