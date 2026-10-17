# Tasks

Règle pour tout le change : le code de production (`scripts/ci-scope.ts`) suit le TDD. Il commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des listes de chemins et des `package.json` écrits à la main d'après la spec, et chaque tâche nomme la mutation qui fait passer son test au rouge. Pour les workflows, la vérification est le résultat observable d'une exécution GitHub, cité avec son numéro dans la PR. On ne relance jamais un job pour le faire passer : un échec se comprend et se corrige. Toutes les actions ajoutées sont pinnées par SHA complet avec leur version en commentaire. `pnpm jscpd` reste à 0 %, et chaque commit passe commitlint. L'ordre des groupes suit les dépendances : la règle, puis les jobs qui s'en servent, puis le reste.

## 1. Règle de classement (`scripts/ci-scope.ts` ; specs « Changement de documentation seule », « PR de release traitée comme documentation », « Repli sur la suite complète »)

- [ ] 1.1 TDD : `onlyVersionChanged(before, after)`, testé dans `tests/scripts/ci-scope.test.ts`. Cas, avec des `package.json` écrits à la main :
  - `version` `0.2.0` → `0.3.0`, rien d'autre → `true` ;
  - `version` `0.2.0` → `0.3.0` et `dependencies.zod` `4.1.0` → `4.2.0` → `false` ;
  - seul `scripts.test` change → `false` ;
  - seul `devDependencies` gagne une clé → `false` ;
  - `packageManager` change → `false` ;
  - mêmes clés dans un autre ordre, même `version` → `true` (comparaison par valeur) ;
  - `after` n'est pas du JSON → `false`.

  Mutation : ne comparer que `dependencies` et `devDependencies` (le cas `scripts.test` passe au rouge), ou comparer les textes bruts (le cas de l'ordre des clés passe au rouge).
- [ ] 1.2 TDD : `isDocsOnly(paths, packageJsonVersionOnly)`. Cas :
  - `["openspec/changes/x/tasks.md", "openspec/changes/x/design.md"]` → `true` ;
  - `["README.md", "CLAUDE.md"]` → `true` ;
  - `["docs/deploy.md", ".github/pull_request_template.md"]` → `true` ;
  - `["openspec/config.yaml"]` → `true` ;
  - `["CHANGELOG.md", ".release-please-manifest.json", "package.json"]` avec `packageJsonVersionOnly = true` → `true` ;
  - la même liste avec `packageJsonVersionOnly = false` → `false` ;
  - `["openspec/changes/x/tasks.md", "src/lib/env.ts"]` → `false` ;
  - `["openspec-tools/x.ts"]` → `false` ;
  - `[".github/workflows/checks.yml"]` → `false` ;
  - `["pnpm-lock.yaml"]` → `false` ;
  - `[]` → `false`.

  Mutation : retourner `true` pour une liste vide, tester `startsWith("openspec")` sans le `/` (le cas `openspec-tools/x.ts` passe au rouge), ou accepter `package.json` sans regarder `packageJsonVersionOnly`.
- [ ] 1.3 TDD : `decideScope({ docsOnly, event, parentConclusion })` rend `"true"` ou `"false"`. Cas :
  - `pull_request`, `docsOnly: true` → `"false"` ;
  - `pull_request`, `docsOnly: false` → `"true"` ;
  - `push`, `docsOnly: true`, `parentConclusion: "success"` → `"false"` ;
  - `push`, `docsOnly: true`, `parentConclusion: "failure"` → `"true"` ;
  - `push`, `docsOnly: true`, `parentConclusion: "cancelled"` → `"true"` ;
  - `push`, `docsOnly: true`, `parentConclusion: null` (aucune exécution trouvée) → `"true"`.

  Mutation : ignorer `parentConclusion` sur un push (les trois derniers cas passent au rouge).
- [ ] 1.4 TDD : le point d'entrée de `scripts/ci-scope.ts` lit la liste des fichiers sur l'entrée standard (une ligne par chemin), prend `--event`, et en option `--package-before <fichier>`, `--package-after <fichier>` et `--parent-conclusion <valeur>`, puis écrit `code=true` ou `code=false` sur la sortie standard. Tests qui lancent `node scripts/ci-scope.ts` avec `execFileSync` :
  - entrée `"openspec/a.md\nsrc/b.ts\n"`, `--event pull_request` → sortie exactement `"code=true\n"` ;
  - entrée `"openspec/a.md\n"`, `--event pull_request` → `"code=false\n"` ;
  - entrée `"CHANGELOG.md\npackage.json\n"` avec deux fichiers qui ne diffèrent que par `version` → `"code=false\n"` ;
  - entrée vide → `"code=true\n"`.

  Mutation : inverser la valeur écrite. Vérifier aussi que la commande tourne dans un dossier sans `node_modules` (le script n'importe que des modules `node:`).

## 2. Job `scope` et sauts sur les PR (décisions 1 et 4 ; specs « Changement de documentation seule », « PR de release traitée comme documentation », « Repli sur la suite complète », « PR fusionnable quand des jobs sont sautés »)

- [ ] 2.1 Ajouter le job `scope` à `checks.yml` : checkout `fetch-depth: 0`, liste des fichiers par `git diff --name-only "$FROM" "$TO"`, les deux `package.json` par `git show` quand il est dans la liste, puis `node scripts/ci-scope.ts ... >> "$GITHUB_OUTPUT"`. `code=true` quand `commit-from` est vide. Conditions : `quality` en `needs: scope` et `if: ${{ !cancelled() }}`, ses étapes Tesseract, typecheck, tests unitaires et jscpd en `if: needs.scope.outputs.code != 'false'` ; `docker` en `if: ${{ !cancelled() && inputs.docker && needs.scope.outputs.code != 'false' }}`. Vérifier : sur la PR de ce change (qui touche `.github/` et `scripts/`), `scope` sort `code=true` et `quality` lance toutes ses étapes.
- [ ] 2.2 Vérifier sur la première PR qui ne touche que `openspec/` après la fusion : `checks / e2e` est « skipped », `checks / quality` n'a lancé ni `pnpm test` ni le typecheck, l'exécution finit en moins de 2 min, et la PR est fusionnable sans contournement d'administrateur. Pousser ensuite sur cette PR un commit `bad message` : `checks / quality` échoue sur commitlint et le bouton de fusion est bloqué ; retirer le commit avant de fusionner.
- [ ] 2.3 Vérifier le repli sur une PR brouillon jetable, jamais fusionnée, qui ne touche que `openspec/` et force l'échec de `scope` (une ligne `exit 1` dans l'étape) : `checks / quality` lance toutes ses étapes, les deux tranches e2e tournent, et `checks / e2e` finit en échec. Fermer la PR et supprimer la branche.
- [ ] 2.4 Vérifier à la première PR de release après la fusion : `scope` sort `code=false`, `checks / e2e` est « skipped », `checks / quality` n'a pas lancé `pnpm test`, et la PR est fusionnable.

## 3. Sauts gardés sur `main` (décision 2 ; spec « Push de documentation ou de release sur main »)

- [ ] 3.1 Dans `scope`, sur un push : lire la conclusion de l'exécution `main` du commit parent avec `gh run list --workflow main.yml --commit "$BEFORE" --json conclusion --jq '.[0].conclusion'` et la passer à `--parent-conclusion`. Ajouter `actions: read` aux permissions de l'appel de `checks.yml` dans `main.yml`, et à celles du job `scope`. Vérifier : `actionlint` ne signale rien, et sur le push de ce change sur `main`, le log de `scope` affiche la conclusion lue pour le commit parent.
- [ ] 3.2 Vérifier au premier push de documentation sur `main` après la fusion, dont le parent est vert : `checks / e2e` et `checks / docker` sont « skipped », et le log de `scope` affiche `success` pour le parent.
- [ ] 3.3 Sur ce même push, vérifier que `release-please` tourne et réussit. S'il est sauté, ajouter à `release-please` la condition `if: ${{ !cancelled() && needs.checks.result == 'success' }}` dans une PR `fix(ci):` et refaire la vérification.
- [ ] 3.4 Vérifier à la première fusion d'une PR de release : `checks / e2e` et `checks / docker` sont « skipped », `release-please` crée le tag, `publish-image` et `publish-manifest` tournent et poussent `vX.Y.Z`, et l'exécution finit en moins de 5 min, contre 10,7 min pour v0.2.0 (39064366413).
- [ ] 3.5 Vérifier la garde dans l'autre sens dès qu'un push sur `main` finit rouge ou annulé : le push de documentation suivant lance la suite complète, build Docker compris, et le log de `scope` affiche la conclusion du parent. Si ça n'arrive pas avant l'archivage, le noter dans la PR de vérification ; les cas de 1.3 couvrent la décision.

## 4. E2e en deux tranches (décision 3 ; spec « E2e répartis sur deux machines »)

- [ ] 4.1 Dans `checks.yml`, remplacer `e2e` par `e2e-shard` (matrice `shard: [1, 2]`, `fail-fast: false`, `if: ${{ !cancelled() && needs.scope.outputs.code != 'false' }}`, `playwright install --with-deps chromium webkit`, `pnpm e2e --shard=${{ matrix.shard }}/2`, rapport d'échec sous `playwright-report-${{ matrix.shard }}`) et ajouter l'agrégateur `e2e` (`needs: [scope, e2e-shard]`, même `if`, une étape qui échoue sauf si `needs.scope.result` et `needs.e2e-shard.result` valent `success`). `playwright.config.ts` garde `workers: 1`. Vérifier : sur la PR de ce change, `checks / e2e-shard (1)`, `checks / e2e-shard (2)` et `checks / e2e` sont verts.
- [ ] 4.2 Sur cette même exécution, vérifier que la somme des « N passed » des deux tranches vaut le nombre de tests listés par `pnpm exec playwright test --list` en local (57 aujourd'hui), que des tests `webkit-iphone` ont tourné, que les étapes « Tests e2e » des deux tranches sont à moins de 30 % l'une de l'autre, et que `checks / e2e` est vert en moins de 3,5 min après le début de l'exécution (médiane actuelle du job : 261 s).
- [ ] 4.3 Vérifier l'échec sur une PR brouillon jetable, jamais fusionnée, avec un test e2e qui échoue toujours : sa tranche est rouge, l'autre va au bout (`fail-fast: false`), `checks / e2e` est rouge, et la PR n'est pas fusionnable. Fermer la PR et supprimer la branche.

## 5. Publication arm64 native (décision 5 ; spec « Publication multi-arch native »)

- [ ] 5.1 Remplacer `publish` dans `main.yml` par `publish-image` (matrice `linux/amd64` sur `ubuntu-24.04`, `linux/arm64` sur `ubuntu-24.04-arm`, push par digest, cache `gha` `scope=golf-handicaps-<arch>`, digest en artefact) et `publish-manifest` (`docker buildx imagetools create` avec les tags et annotations de `docker/metadata-action`), tous deux sous la condition `release_created`. Retirer `docker/setup-qemu-action`. Permissions : `contents: read` et `packages: write` sur les deux jobs, rien d'autre. Vérifier : `actionlint .github/workflows/main.yml` ne signale rien, et la PR passe sa CI.
- [ ] 5.2 Vérifier à la première release après la fusion :
  - `docker buildx imagetools inspect ghcr.io/emmpaul/golf-handicaps:vX.Y.Z` liste `linux/amd64` et `linux/arm64` ;
  - `latest` et le tag du SHA ont le même digest que `vX.Y.Z` ;
  - `imagetools inspect --raw` montre `org.opencontainers.image.version` = `X.Y.Z` dans les annotations de l'index ;
  - le job `publish-image` arm64 n'a aucune étape QEMU, et l'ensemble `publish-image` + `publish-manifest` prend moins de 4 min, contre 6,0 min pour v0.2.0 (39064366413).

## 6. Tests stables et signalés (décisions 6 et 8 ; specs « Délai des tests unitaires qui lancent Tesseract », « Tests e2e instables signalés »)

- [ ] 6.1 Mettre un délai de 30 s, avec un commentaire qui en donne la raison, sur les tests qui lancent le binaire Tesseract : `tests/ocr/tesseract-reader.test.ts`, `tests/ocr/read-scorecard.test.ts`, `tests/jobs/ocr-scorecard.test.ts`. Ne pas toucher au délai global de `vitest.config.mts`. Vérifier par mutation : ajouter temporairement une attente de 6 s avant la lecture dans « lit 16 dans la case INDEX du trou 2 avec le binaire tesseract natif » ; le test passe. Retirer le délai de 30 s en gardant l'attente : il échoue sur `Test timed out in 5000ms`. Revenir aux deux changements.
- [ ] 6.2 Sur une PR brouillon jetable, jamais fusionnée, ajouter un test e2e qui échoue quand `testInfo.retry === 0` et passe ensuite. Relever ce que le résumé de l'exécution affiche. S'il ne nomme pas le test comme instable, ajouter le reporter `json` en CI dans `playwright.config.ts` et une étape `if: always()` dans `e2e-shard` qui écrit les tests au statut `flaky` dans `$GITHUB_STEP_SUMMARY`, sans `failOnFlakyTests`. Vérifier : l'exécution de la PR brouillon est verte et son résumé nomme le test comme instable. Fermer la PR et supprimer la branche.

## 7. Hygiène et documentation

- [ ] 7.1 Ajouter `DOCKER_BUILD_RECORD_UPLOAD: false` à l'environnement des étapes `docker/build-push-action` de `checks.yml` et de `main.yml`. Vérifier : le push sur `main` qui suit la fusion ne crée aucun nouvel artefact `*.dockerbuild` (`gh api repos/emmpaul/golf-handicaps/actions/runs/<id>/artifacts` renvoie `total_count: 0` pour une exécution verte).
- [ ] 7.2 Mettre à jour la section CI/CD de `README.md` et la décision 7 de `openspec/changes/add-golf-handicap-tracker/design.md` : contrôles sautés pour la documentation et la PR de release, garde sur `main`, e2e en deux tranches avec l'agrégateur `checks / e2e`, publication native par architecture. Vérifier : `grep -n "QEMU\|setup-qemu" README.md .github/workflows/*.yml` ne trouve rien.

## 8. Réglages du repo (humain)

- [ ] 8.1 Après la fusion de ce change, vérifier que les contrôles requis n'ont pas changé malgré la matrice e2e : `gh api repos/emmpaul/golf-handicaps/branches/main/protection --jq '.required_status_checks.contexts'` renvoie exactement `["checks / quality","checks / e2e"]`, sans `checks / e2e-shard (1)` ni `(2)`. Ne rien ajouter ni retirer.
- [ ] 8.2 Vérifier que l'option « Require branches to be up to date before merging » est toujours cochée (décision 7) : `gh api repos/emmpaul/golf-handicaps/branches/main/protection --jq '.required_status_checks.strict'` renvoie `true`. La garde de la décision 2 en dépend pour la release.

## Workflow follow-up

- Brancher depuis `origin/main` (`ci/improve-ci-pipeline`), une PR pour le change, fusion une fois la CI verte.
- Les vérifications 2.2, 2.4, 3.2 à 3.5, 5.2 et 7.1 se font après la fusion, sur les exécutions suivantes ; on coche les tâches avec le numéro d'exécution dans une PR `docs(openspec):`.
- Archiver ce change (`/opsx:archive`) une fois ces vérifications cochées.
