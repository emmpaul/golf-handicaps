# Design

## Context

Motivation : voir `proposal.md`. Comportements attendus : voir `specs/ci-pipeline/spec.md`.

### Mise en place actuelle

- `pr.yml` (`pull_request`, tous types par défaut) appelle `checks.yml` avec la plage de commits de la PR. Concurrence `pr-<numéro>`, `cancel-in-progress: true`.
- `main.yml` (`push` sur `main`) appelle `checks.yml` avec `docker: true`, puis `release-please` (`needs: checks`, token `RELEASE_PLEASE_TOKEN`), puis `publish` seulement si `release_created`. Concurrence `main`, `cancel-in-progress: false`.
- `checks.yml` : trois jobs en parallèle sur `ubuntu-24.04`.
  - `quality` : checkout complet (`fetch-depth: 0`), setup (pnpm, Node, `pnpm install --frozen-lockfile`), apt `tesseract-ocr`, `check:pins`, commitlint, lint, typecheck, `pnpm test`, jscpd.
  - `e2e` : setup, apt `tesseract-ocr`, `playwright install --with-deps chromium webkit`, `pnpm e2e`. Le `webServer` de Playwright lance `pnpm build` puis `next start`, et le worker. `workers: 1`, `retries: 1` en CI, reporter `github`.
  - `docker` (sur `main`) : build buildx avec cache `gha` `mode=max`, contrôle « aucune fixture », setup, Playwright chromium, test de fumée compose.
- `publish` : QEMU + buildx, build `linux/amd64,linux/arm64` en une commande, push GHCR, cache `golf-handicaps-multiarch`.
- Protection de `main` (lue via l'API) : contrôles requis `checks / quality` et `checks / e2e`, `strict: true` (branche à jour obligatoire), admins inclus, 0 relecture.
- Toutes les actions sont pinnées par SHA. Permissions minimales par workflow et par job. Repo public, donc runners standard gratuits (4 vCPU) et `ubuntu-24.04-arm` disponible.

### Données d'exécution

Source : `gh run list` puis `GET /actions/runs/<id>/attempts/<n>/jobs` et les logs de chaque job, pour les 30 exécutions du 17/10/2026 (39053454318 à 39064931391), relances comprises. Durées à la seconde, tirées des horodatages des jobs et des étapes. L'attente en file est de 2 à 4 s pour tous les jobs : la file n'est pas un problème.

**Jobs réussis**

| Job | n | Médiane | Max (exécution) |
|---|---|---|---|
| `checks / quality` | 23 | 84 s | 107 s (39063186666) |
| `checks / e2e` | 24 | 261 s | 329 s (39059753505) |
| `checks / docker` | 16 | 117 s | 354 s (39053454318, cache froid) |
| `release-please` | 11 | 8 s | 13 s (39056539603) |
| `publish` | 2 | — | 582 s (39056539603, v0.1.0) ; 360 s (39064366413, v0.2.0) |

**Étapes les plus longues**

| Job / étape | Médiane | Max (exécution) |
|---|---|---|
| publish / Build multi-arch et push | — | 548 s (39056539603) ; 296 s (39064366413) |
| e2e / Tests e2e (`pnpm e2e`, build Next compris) | 194 s | 249 s (39059753505) |
| e2e / Navigateurs Playwright | 39 s | 49 s (39056539603) |
| quality / Tests unitaires | 38,5 s | 70 s (39063186666) |
| docker / Navigateur Playwright | 23 s | 29 s |
| setup (pnpm + Node + install), chaque job | 18 à 19,5 s | 35 s (39057769313) |
| docker / Test de fumée compose | 22,5 s | 46 s (39059753505) |
| docker / Build de l'image (sans push) | 17,5 s | 236 s (39053454318, cache froid) |
| quality / Tesseract (apt) | 11 s | 19 s |
| e2e / Tesseract (apt) | 10,5 s | 19 s |
| quality / typecheck, lint, commitlint, `check:pins`, jscpd | 0 à 2 s chacun | 4 s |

Détail de la publication, tiré des logs buildx :
- v0.1.0 (job 117466617950) : arm64 sous QEMU, `pnpm install` 114 s, apt `tesseract-ocr` 154 s, `pnpm build` 306 s.
- v0.2.0 (job 117489743879) : `pnpm build` arm64 118 s, contre 38,8 s en amd64 dans le même job, et export du cache `mode=max` 108 s.
- Dans le job `docker` (amd64 natif), `RUN pnpm build` prend 13,7 à 26,3 s quand il n'est pas en cache.

**Caches mesurés**
- Store pnpm (`setup-node` `cache: pnpm`) : restauré dans les 51 jobs dont on a le log (deux clés, `baeffdf…` puis `fbcc75c…` après le lockfile de #7). Pas de cache manqué.
- Cache Docker `gha` : tout est `CACHED` quand seuls `openspec/` ou des `.md` changent (39059753505, job 117475101179), puisque `.dockerignore` les exclut. Le build ne refait que `pnpm build` quand `src/` change (13,7 s, 39063186666).
- Build Next dans les e2e : aucun cache `.next/cache`. Le build ne coûte que 15 à 25 s d'après les mesures Docker, donc le gain possible est faible.

**Variabilité des runners** : avec le même code, la phase de test e2e (45 tests) prend 1,1 à 1,6 min avant 18 h 27 (39054282423 à 39057769313) et 2,9 à 4,1 min après (39058133406 à 39059753505). La durée de `pnpm test` passe de 24 s à 50 s au même moment, sans changement de code (`b57f311` ne touche que `main.yml`). Tous les runners annoncent la même image (`ubuntu24/20261012.334`). On en conclut que la vitesse des machines varie du simple au double, et les délais des tests doivent en tenir compte.

**Exécutions qui n'auraient pas dû tourner en entier** (PR #3, #6, #8, #10 et pushes correspondants sur `main`, fichiers lus via `gh pr list --json files`) :

| Exécution | Événement | Fichiers | Durée totale | Minutes de runner |
|---|---|---|---|---|
| 39055903251 | push `main` | `openspec/` | 2,6 min | 5,3 |
| 39057769313 | PR #3 | `CLAUDE.md`, `openspec/` | 3,2 min | 6,8 |
| 39058133406 | push `main` (#3) | `CLAUDE.md`, `openspec/` | 4,2 min | 7,5 |
| 39059165291 | PR #6 | `openspec/` | 4,5 min | 6,0 |
| 39059753505 | push `main` (#6) | `openspec/` | 5,7 min | 9,2 |
| 39063275738 | PR #8 (2 essais) | `openspec/` | 6,5 min | 7,5 |
| 39063834376 | push `main` (#8) | `openspec/` | annulée à la main par Manu après 1,4 min | 3,4 |
| 39064430944 | PR #10 | `openspec/` | remplacée après 1,6 min | 3,0 |
| 39064453470 | PR #10 | `openspec/` | 6,4 min | 6,3 |
| 39064931391 | push `main` (#10) | `openspec/` | 7,0 min, dont 2,7 min d’attente derrière la release | 7,4 |

Soit 10 exécutions sur 30 et environ 62 minutes de runner pour des changements sans code.

**Autres exécutions évitables**
- 39063852764 : PR de release relancée par le commit `7fb27b27` « Merge branch 'main' into release-please--… », produit par le bouton « Update branch » qu'impose `strict: true`. Son seul contenu était les fichiers `openspec/` de #8. Elle a remplacé 39063515183 (5,3 min perdues), puis a pris 7,1 min avec une relance.
- 39064366413 : fusion de la PR de release v0.2.0 (`CHANGELOG.md`, `package.json` version, manifeste). La suite complète et le build Docker ont retourné 4,4 min avant `publish`. Le même contenu venait de passer sur la PR.

**Échecs et causes**

| Exécution | Job / étape | Cause | Suite |
|---|---|---|---|
| 39053454318 | e2e / Tests e2e | `tests/e2e/access.spec.ts:28` sur `webkit-iphone` : le cookie `golf_session` n'est pas lu (`Received: undefined`), échec aussi à la nouvelle tentative. Vrai défaut du test | corrigé par `6d04b9d` |
| 39054525063 | — | `action_required` : PR de release ouverte par `github-actions[bot]` avec `GITHUB_TOKEN` | corrigé par #4 (PAT) |
| 39054867488 | — | « workflow file issue », aucun job, même cause | corrigé par #4 |
| 39055636629 | quality / Commitlint | commit `bad message`, voulu (vérification de la tâche 9.3 de `add-golf-handicap-tracker`) | attendu |
| 39063275738 essai 1 | quality / Tests unitaires | `tests/ocr/tesseract-reader.test.ts` « lit 16 dans la case INDEX du trou 2 avec le binaire tesseract natif » : `Test timed out in 5000ms` (5 043 ms) | vert à la relance |
| 39063852764 essai 1 | quality / Tests unitaires | même test, même dépassement | vert à la relance |

Durées de ce test dans les 23 logs : de 434 ms à 5 043 ms, dont 7 au-dessus de 2 s. Dans le même temps, `tests/jobs/ocr-scorecard.test.ts` prend 44 s et `tests/ocr/read-scorecard.test.ts` 14 s (job 117488433297) : les fichiers qui lancent Tesseract se disputent les 4 vCPU.

**Ce qui marche et ne change pas**
- L'annulation des PR remplacées : 39058142780, 39058619897 et 39064430944 ont été coupées par le push suivant, qui avait un autre SHA.
- Aucun test e2e instable dans les 22 logs e2e lus : la nouvelle tentative de Playwright ne cache rien pour l'instant.
- Permissions, pins par SHA, cache pnpm, cache Docker amd64.

**Petits défauts**
- `docker/build-push-action` téléverse un artefact d'enregistrement de build (`*.dockerbuild`) à chaque build : 17 artefacts sur 18 dans le repo, gardés 90 jours, que personne ne lit.

## Goals / Non-Goals

**Goals :**
- Une PR ou un push de documentation seule finit en moins de 2 min, et la PR reste fusionnable sans contournement.
- La PR de release et le push de release sur `main` ne relancent plus la suite complète : le push de release va directement à release-please puis à la publication.
- Le contrôle `checks / e2e` d'une PR de code passe d'environ 4,4 min (médiane 261 s) à environ 3 min.
- La publication d'une release passe d'environ 6 à 10 min à environ 3 min.
- Plus aucune relance pour le test Tesseract.
- Si la CI ne sait pas classer un changement, elle lance tout. Un contrôle requis n'est jamais sauté par erreur.

**Non-Goals :**
- Plusieurs workers Playwright sur une même machine (`workers > 1`). Les tests remettent la base à zéro et partagent un serveur. Il faudrait une base par worker. Le découpage en trois machines (décision 3) contourne la contrainte sans y toucher.
- Mettre en cache `.next/cache`, les navigateurs Playwright ou les paquets apt. Gains mesurés : 15 à 25 s de build, 39 s de navigateurs (dont l'essentiel en dépendances système que `--with-deps` réinstalle de toute façon), 11 s d'apt. Pas assez pour la complexité et les clés de cache à maintenir.
- Toucher à release-please, au PAT, au déploiement Dokploy ou à la protection de `main`.

## Decisions

Classées par temps gagné et par risque.

### 1. Classement des changements dans un job `scope`, avec repli sur la suite complète (gain : 3 à 4 min par exécution de documentation, environ 40 min de runner sur la journée observée ; risque faible)

Un job `scope` en tête de `checks.yml` écrit une sortie `code` qui vaut `true` ou `false`. La logique vit dans `scripts/ci-scope.ts`, en fonctions pures testées par Vitest comme `check-pins.ts`. Le job l'exécute avec `node scripts/ci-scope.ts`, sans installer les dépendances : Node 24 enlève les types tout seul, et le script n'importe que des modules `node:`.

Entrées du script, calculées par le job à partir de `commit-from` et `commit-to`, que `checks.yml` reçoit déjà :
- la liste des fichiers modifiés (`git diff --name-only "$FROM" "$TO"`), sur l'entrée standard ;
- si `package.json` est dans la liste, ses deux versions (`git show "$FROM:package.json"` et `git show "$TO:package.json"`) dans des fichiers temporaires passés en argument ;
- sur un push sur `main`, la conclusion de l'exécution `main` du commit parent (décision 2).

Règle `isDocsOnly` : un changement est de la documentation si chaque fichier modifié est sous `openspec/` ou `docs/`, se termine par `.md`, est `.release-please-manifest.json`, ou est `package.json` avec seulement le champ `version` changé (décision 4). Une liste vide n'est pas de la documentation. Sur un premier push où `commit-from` est vide, `code` vaut `true`.

**Repli sûr.** Les jobs ne testent jamais `code == 'true'`, mais `code != 'false'`. Si `scope` échoue ou ne rend rien, la sortie est vide, et tout tourne :
- `quality` : `needs: scope`, `if: ${{ !cancelled() }}`. Le job tourne toujours : commitlint, `check:pins` et le lint passent sur toute PR. Les étapes Tesseract, typecheck, tests unitaires et jscpd prennent `if: needs.scope.outputs.code != 'false'`.
- `e2e-shard` et `docker` : `if: ${{ !cancelled() && needs.scope.outputs.code != 'false' }}` (plus `inputs.docker` pour `docker`).
- Le job agrégateur `e2e` suit la même règle (décision 3).

Un job sauté par `if:` rend « skipped », que la protection de branche compte comme réussi. Sans le `!cancelled()`, l'échec de `scope` ferait sauter `quality` et `e2e`, qui rendraient « skipped », donc réussis : un contrôle requis passerait sans avoir tourné. Le repli l'empêche.

*Alternatives écartées* :
- `paths-ignore` au niveau du déclencheur `pull_request` : le workflow ne démarre pas, `checks / quality` et `checks / e2e` restent « en attente » pour toujours, et la PR n'est plus fusionnable. C'est le piège classique des contrôles requis filtrés par chemin.
- `dorny/paths-filter` : une action de plus à pinner et à suivre avec Renovate, elle a besoin de `pull-requests: read`, et elle ne sait pas lire le contenu de `package.json` pour la règle de version.
- Sauter tout le job `quality` : on perdrait commitlint sur les PR de documentation, et la spec le garde.

### 2. Push de documentation ou de release sur `main` : saut gardé par l'exécution parente (gain : 4,4 min avant `publish` à chaque release, 39064366413 ; 2,6 à 5,7 min par push de documentation ; risque faible)

Le push de la PR de release sur `main` (`CHANGELOG.md`, `.release-please-manifest.json`, `package.json` dont seule la `version` change) est de la documentation au sens de la décision 1. Il saute donc les étapes lourdes de `quality`, les e2e et le build Docker, puis release-please tourne, signale `release_created`, et `publish` construit et pousse l'image.

**Détection par le contenu, pas par le sujet du commit.** Un commit intitulé `chore(main): release 0.3.0` qui toucherait `src/` prendrait la suite complète. Le sujet n'est jamais lu.
*Alternative* : tester le sujet `chore(main): release`. Écartée : il ne dit rien du contenu, et n'importe quel commit peut porter ce sujet.
*Alternative* : lire la sortie `release_created` de release-please avant les contrôles. Écartée : il faudrait lancer release-please en premier, et sur un push ordinaire il mettrait à jour la PR de release avant de savoir si `main` est vert.

**Garde.** Sur un push sur `main`, `scope` rend `code=false` seulement si l'exécution du workflow `main` pour le commit parent (`github.event.before`) a fini « success ». Sinon (échec, annulation, aucune exécution trouvée, `before` à zéro), il rend `code=true`. Le job lit la conclusion avec `gh run list --workflow main.yml --commit "$BEFORE" --json conclusion` et a besoin de `actions: read`, en plus de `contents: read`, dans l'appel de `checks.yml` depuis `main.yml`. La décision elle-même (`decideScope`) est une fonction pure de `scripts/ci-scope.ts`, testée.

Pourquoi la garde : sans elle, un push de documentation qui suit un push de code rouge finirait vert, et release-please, qui ne tourne qu'après des contrôles verts, mettrait à jour la PR de release avec le commit cassé. La concurrence `main` (`cancel-in-progress: false`) garantit que l'exécution parente est finie quand la suivante démarre. La garde se propage : un push sauté ne finit « success » que si son parent l'était.

Pourquoi c'est sûr pour la release : l'option « branche à jour » reste cochée (décision 7). La PR de release est donc à jour avec `main` quand on la fusionne, et l'arbre fusionné vaut celui du dernier commit de `main` plus la version. La garde vérifie que ce dernier commit a passé la suite complète, build Docker et test de fumée compris.

`publish` ne change pas de condition : `needs: [checks, release-please]` et `if: needs.release-please.outputs.release_created == 'true'`. Un workflow appelé dont des jobs sont sautés finit « success », donc `release-please` puis `publish` tournent. On le vérifie au premier push de documentation (tâche 3.3), et on ajoute `if: ${{ !cancelled() && needs.checks.result == 'success' }}` à `release-please` si ce n'est pas le cas.

Coût accepté : l'image publiée n'a pas son propre test de fumée. Elle est construite à partir du même arbre que le commit parent, qui l'a passé, à la version près.

### 3. E2e en trois machines, avec un agrégateur nommé `e2e` (gain : environ 1,5 min par PR de code ; risque moyen)

`checks.yml` remplace le job `e2e` par :
- `e2e-shard`, en matrice `shard: [1, 2, 3]`, `fail-fast: false`. Chaque entrée fait le setup, apt `tesseract-ocr`, `playwright install --with-deps chromium webkit`, puis `pnpm e2e --shard=${{ matrix.shard }}/3`. Le rapport d'échec est téléversé sous `playwright-report-${{ matrix.shard }}`.
- `e2e`, l'agrégateur : `needs: [scope, e2e-shard]`, `if: ${{ !cancelled() && needs.scope.outputs.code != 'false' }}`. Son unique étape échoue sauf si `needs.scope.result` et `needs.e2e-shard.result` valent tous les deux `success`. Le contrôle requis garde son nom `checks / e2e`. Les entrées `checks / e2e-shard (1)`, `(2)` et `(3)` ne sont pas requises.

Comportement de l'agrégateur :
- code, trois tranches vertes : réussi ;
- une tranche rouge ou annulée : échec, PR non fusionnable ;
- documentation seule : sauté, donc réussi pour la protection ;
- `scope` en échec : les tranches tournent (repli), et l'agrégateur échoue puisque `needs.scope.result` n'est pas `success`.

**Une machine, un serveur, une base par tranche.** Chaque tranche est un runner à part. Le `webServer` de `playwright.config.ts` y lance son propre `pnpm build`, son `next start` et son worker, avec son propre `E2E_DATA_DIR`. `workers: 1` ne change pas : à l'intérieur d'une tranche, les tests restent un par un sur une seule base. Le découpage ne touche pas la contrainte qui interdit `workers > 1`.

**Build refait dans chaque tranche.** Il coûte 15 à 25 s (mesures Docker). Le partager voudrait un job de build en amont, un artefact `.next/` d'environ 100 Mo à téléverser puis à télécharger, et un `webServer` qui saute le build en CI. Ce job en série coûterait plus que les 15 à 25 s gagnés.

**Trois tranches, découpées test par test avec `fullyParallel: true`.** Le premier essai répartissait des fichiers entiers entre deux tranches. Sur trois exécutions de la PR #14, l'étape « Tests e2e » prenait 161 à 166 s dans la tranche 1/2 et 76 à 102 s dans la 2/2, bien au-delà des 30 % de la tâche 4.2. Playwright coupe la liste en blocs contigus d'un même nombre de tests, et la version 1.64 n'a aucune option pour couper selon la durée. Avec deux tranches, `fullyParallel: true` donne le même découpage qu'avant : la 1/2 reçoit 38 tests Chromium, dont 7 lectures OCR, et la 2/2 reçoit 15 tests Chromium et les 22 WebKit iPhone, avec 3 lectures OCR. Tesseract est lent sur les runners GitHub, donc la 1/2 reste la plus longue.

La matrice passe donc à trois tranches, avec `fullyParallel: true` et toujours `workers: 1`. Rien ne tourne en parallèle sur une machine : l'option sert seulement à `--shard`, qui coupe alors la liste test par test. En local, `--list` compte 75 tests, et `--shard=N/3` en donne 25 à chaque tranche :
- 1/3 : Chromium, de `access` aux deux premiers tests de `desktop-grid`, avec 3 lectures OCR ;
- 2/3 : Chromium, des deux derniers tests de `desktop-grid` à `rounds:67`, avec 4 lectures OCR ;
- 3/3 : Chromium `rounds:82` et `strokes`, puis les 22 tests WebKit iPhone.

Avant d'activer l'option, on a vérifié que chaque test part d'un état connu. La fixture automatique de `tests/e2e/fixtures.ts` appelle `resetData()` (`tests/e2e/data.ts`) puis ouvre une session avant chaque test : la base revient aux trois joueurs initiaux, les tables `jobs` et `imports` sont vidées et les compteurs d'id repartent à 1. Tous les fichiers l'utilisent, sauf `access` et `home`, qui ne lisent aucune donnée. Aucun `describe.serial`, aucun `describe.configure`, aucun `beforeAll` ni variable partagée entre tests. Les tests qui lancent une lecture OCR attendent qu'elle finisse, donc le worker n'a plus de job en cours quand le test suivant remet la base à zéro. Les cinq exécutions locales (`--shard` 1/2, 2/2, puis 1/3, 2/3, 3/3, qui changent les voisins de chaque test) sont toutes vertes, sans nouvelle tentative.

Les tests WebKit tombent aujourd'hui tous dans la 3/3, mais un test ajouté décale les blocs. Chaque tranche installe donc les deux navigateurs (39 s, déjà payé aujourd'hui).

*Alternative* : une tranche par projet (Chromium, WebKit iPhone). Écartée : 53 tests contre 22, la tranche Chromium garderait l'essentiel du temps.
*Alternative* : garder la répartition par fichier et déplacer un fichier lourd à la main. Écartée : l'équilibre casserait au premier fichier ajouté.

Coût : deux machines de plus par PR de code (environ 1,5 min chacune de setup, Tesseract, navigateurs et build), donc plus de minutes de runner, gratuites pour un repo public.

### 4. Bump de version traité comme de la documentation (gain : 5 à 7 min par PR de release ; risque faible)

`onlyVersionChanged(before, after)` dans `scripts/ci-scope.ts` compare les deux `package.json` analysés, champ `version` retiré, par valeur (clés et valeurs, dans tous les sous-objets). Il rend `true` seulement si tout le reste est égal. Un JSON illisible rend `false`. Une PR de release ne touche que `CHANGELOG.md`, `.release-please-manifest.json` et la version de `package.json`, donc elle saute les e2e et les étapes lourdes. Elle passe quand même commitlint, `check:pins` et le lint.

Ce que la CI ne voit plus sur une PR de release : une version mal formée. Le risque est faible, release-please l'écrit lui-même, et `check:pins` ne lit pas ce champ de toute façon.

### 5. Image arm64 construite sur un runner arm64 natif (gain : 3 à 7 min par release ; risque moyen)

`publish` devient deux jobs :
- `publish-image`, en matrice `{ platform: linux/amd64, runner: ubuntu-24.04 }` et `{ platform: linux/arm64, runner: ubuntu-24.04-arm }`. Chaque entrée construit une seule plateforme et la pousse par digest seulement (`outputs: type=image,push-by-digest=true,name-canonical=true,push=true`), avec un cache `gha` par architecture (`scope=golf-handicaps-<arch>`), et téléverse son digest en artefact.
- `publish-manifest` (`needs: publish-image`) télécharge les deux digests et crée l'index multi-arch avec `docker buildx imagetools create`, avec les tags de `docker/metadata-action` (`vX.Y.Z`, `latest`, SHA) et les annotations OCI au niveau de l'index.

Les deux jobs gardent la condition `release_created`. Plus de `setup-qemu-action`. C'est le schéma documenté par Docker pour les builds multi-plateformes répartis sur plusieurs runners.

*Alternative* : garder QEMU et passer le cache à `mode=min`. On gagnerait une partie des 108 s d'export, pas les 118 à 306 s de `pnpm build` émulé.
*Alternative* : compiler en croisé depuis amd64 (`--platform=$BUILDPLATFORM` pour l'étape de build). `better-sqlite3` et `sharp` ont des binaires natifs choisis à l'install, donc l'étape `deps` devrait quand même tourner en arm64. Trop fragile.

### 6. Délai explicite pour les tests qui lancent Tesseract (gain : une relance d'environ 1,5 min et une intervention humaine, 2 fois sur 23 ; risque très faible)

Les tests qui lancent le vrai binaire (`tests/ocr/tesseract-reader.test.ts`, `tests/ocr/read-scorecard.test.ts`, `tests/jobs/ocr-scorecard.test.ts`) prennent un délai de 30 s, déclaré dans chaque fichier (`describe(..., { timeout: 30_000 })` ou troisième argument de `it`), avec un commentaire qui dit pourquoi. Le délai global de Vitest reste à 5 s pour les autres tests, qui doivent rester rapides.

*Alternative* : `testTimeout: 30_000` global. Un test lent par erreur ne serait plus repéré.
*Alternative* : faire tourner ces fichiers seuls (`poolMatchGlobs` ou un projet Vitest à un seul worker). Ça enlève la contention mais rallonge `pnpm test`. À revoir si la durée continue de monter.

### 7. Option « branche à jour » gardée (aucun changement de réglage)

L'option « Require branches to be up to date before merging » (`strict: true`) reste cochée. Les relances qu'elle impose sont un coût accepté : chaque fusion oblige les autres PR ouvertes, dont la PR de release, à cliquer « Update branch », ce qui crée un commit de fusion et relance la CI (39063515183 remplacée, puis 39063852764 : 7,1 min avec une relance). Avec la décision 4, la PR de release mise à jour avec un commit de documentation sera sautée en moins de 2 min. Une PR de code mise à jour relancera la suite complète, et c'est voulu.

*Alternative écartée* : décocher l'option, pour 5 à 7 min de gagnées par fusion qui en suit une autre. Elle rendrait la décision 2 fausse : l'arbre fusionné d'une PR de release pourrait différer de celui que la garde a vérifié, et une image non testée partirait sur GHCR.

### 8. Tests e2e instables signalés, sans faire échouer (gain : aucun en temps ; risque nul)

On garde `retries: 1` en CI, sans `failOnFlakyTests`. Un test qui passe à la deuxième tentative laisse l'exécution verte, et son nom doit apparaître dans le résumé. On vérifie d'abord ce que le reporter `github` affiche pour un tel test (tâche 6.2). S'il ne le nomme pas, on ajoute le reporter `json` en CI et une étape `if: always()` dans chaque tranche qui écrit les tests au statut `flaky` dans `$GITHUB_STEP_SUMMARY`.

*Alternative écartée* : `failOnFlakyTests: true`. La vitesse des runners varie du simple au double (voir Context). Une instabilité de machine bloquerait une PR sans défaut dans le code.

### 9. Plus d'enregistrements de build Docker en artefact (gain : stockage seulement ; risque nul)

`DOCKER_BUILD_RECORD_UPLOAD: false` sur les étapes `docker/build-push-action` de `checks.yml` et `main.yml`. Le résumé de build dans la page de l'exécution reste.

### 10. Ce qu'on ne change pas

- La concurrence `main` reste `cancel-in-progress: false` : couper release-please ou un push d'image en cours laisserait un tag ou un manifeste à moitié fait, et la garde de la décision 2 compte sur une exécution parente finie. Les décisions 1 et 2 suffisent à raccourcir la file (39064931391 a attendu 2,7 min derrière la release).
- Les déclencheurs : il n'y a pas de doublon `push` + `pull_request`, puisque `pr.yml` n'écoute que `pull_request` et `main.yml` que les pushes sur `main`.
- Renovate n'a pas encore ouvert de PR (premier passage lundi avant 6 h). Ses PR touchent les dépendances de `package.json` et le lockfile, donc elles prennent la suite complète, ce qui est voulu.

## Risks / Trade-offs

- [Un fichier `*.md` lu par le code, ou un futur `.mdx`, serait classé documentation] → aucun aujourd'hui (`src/` n'a pas de `.md`). La règle et ses tests le disent. Si ça arrive, on ajoute l'exception dans `isDocsOnly` avec son test.
- [`scope` en échec fait sauter un contrôle requis] → repli `code != 'false'` et `!cancelled()` (décision 1), vérifié par la tâche 2.3.
- [La garde lit mal la conclusion du parent (API en panne, exécution relancée)] → tout ce qui n'est pas exactement « success » donne la suite complète. On perd du temps, pas de la sûreté.
- [Le nom du contrôle requis change avec la matrice] → l'agrégateur garde `checks / e2e`. La tâche humaine 8.1 revérifie la liste après fusion.
- [Tranches déséquilibrées] → Playwright coupe par nombre de tests, pas par durée, et une lecture OCR pèse bien plus qu'un test d'écran. On mesure la première exécution à trois tranches (tâche 4.2). Si l'écart dépasse 30 %, on compte les lectures OCR de chaque tranche avant de toucher au nombre de tranches.
- [`release-please` sauté si le workflow appelé ne finit pas « success » quand des jobs sont sautés] → vérifié sur le premier push de documentation (tâche 3.3), avec la condition de repli prête.
- [L'index multi-arch perd les annotations OCI ou un tag] → la tâche 5.2 compare l'index publié avec `imagetools inspect --raw`, et la vérification réelle tire l'image sur arm64.
- [Le runner `ubuntu-24.04-arm` est en file plus longtemps que l'amd64] → acceptable pour une release, qui n'arrive que quelques fois par semaine. On le mesure à la première release.
- [Un délai de 30 s cache un vrai ralentissement de l'OCR] → le délai est limité aux trois fichiers concernés, et Vitest affiche toujours la durée de chaque fichier.

## Migration Plan

1. Fusionner la PR de ce change. Elle touche `.github/` et `scripts/`, donc elle prend la suite complète, en trois tranches : c'est le premier test des décisions 1 et 3.
2. La première PR de documentation suivante, puis son push sur `main`, vérifient le saut, la fusionnabilité et la garde.
3. La première release suivante vérifie la PR de release sautée, le push de release qui va directement à `publish`, et la publication native.
4. Retour arrière : revenir sur la PR. Aucun état n'est gardé en dehors des workflows, sauf les nouvelles portées de cache Docker, que GitHub purge seul après 7 jours sans usage.

## Open Questions

- ~~Faut-il passer à `fullyParallel: true` pour équilibrer les tranches au test près ?~~ Réglée : oui, et chaque test remet bien la base à zéro (décision 3). Seule, l'option ne suffit pas : avec deux tranches, elle donne le même découpage que par fichier.
- ~~Faut-il une troisième tranche quand les e2e dépasseront 5 min ?~~ Réglée : oui, dès maintenant. La CI mesurait 161 à 166 s contre 76 à 102 s avec deux tranches (décision 3). La spec « E2e répartis sur trois machines » et les tâches 4.1 à 4.3 suivent.
