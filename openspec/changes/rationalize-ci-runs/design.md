# Design

## Context

Motivation : voir `proposal.md`. Comportements attendus : voir `specs/ci-pipeline/spec.md`.

### Mise en place actuelle (après #14)

- `pr.yml` appelle `checks.yml` sans `docker`. `main.yml` l'appelle avec `docker: true`, puis `release-please`, puis `publish-image` (matrice amd64/arm64 sur runners natifs) et `publish-manifest` si une release est créée.
- `checks.yml` : `scope` (classement par `scripts/ci-scope.ts`, garde « exécution `main` du parent réussie » sur `push`), `quality` (pins, commitlint, lint, typecheck, `pnpm test`, jscpd, dans un seul job), `e2e-shard` ×3 (chacune lance `pnpm build` par le `webServer` de Playwright), agrégateur `e2e`, `docker` (build sans push, contrôle « aucune fixture », fumée compose).
- Protection de `main` lue le 18/10/2026 : contrôles requis `checks / quality` et `checks / e2e`, `strict: true`, `enforce_admins: true`. Squash, merge et rebase sont autorisés.
- `vitest.config.ts` : un seul projet, parallélisme par défaut (un processus par cœur). 11 fichiers de `tests/` lancent Tesseract, sharp ou scrypt ; 63 tests y portent un délai `60_000` écrit à la main.
- `lefthook.yml` : `biome` et `typecheck` au commit, `test` et `jscpd` au push, sans filtre de fichiers sur `typecheck`, `test` ni `jscpd`. lefthook 2.2.2.

### Données d'exécution (17 et 18/10/2026)

| Exécution | Job | Durée | Étape dominante |
|---|---|---|---|
| `pr` #28, verte | `quality` | 166 s | Tests unitaires 117 s |
| | `e2e-shard (1/2/3)` | 176 / 339 / 210 s | Tests e2e 97 / 260 / 107 s |
| `main` après #28 | `quality` | 166 s | Tests unitaires 124 s |
| | `e2e-shard (1/2/3)` | 168 / 278 / 230 s | Tests e2e 90 / 208 / 137 s |
| | `docker` | 166 s | Build 66 s, fumée 40 s |
| `main` après #26 | `docker` | 255 s | Build 140 s |
| CodeQL (configuration par défaut) | — | 46 à 80 s | non bloquant |

Échecs `pr` depuis #14 : 6 sur `Tests unitaires` (délai de 5 s ou 60 s dépassé, budget de 2 s de CPU dépassé à 2,8 s), 1 sur les e2e (#20), 1 sur commitlint (volontaire, test du contrôle). Aucun échec unitaire n'a été reproduit en local.

`.next` après un build local : 26 Mo `server`, 1,5 Mo `static`, 54 Mo `standalone`, 350 Mo `cache`.

## Goals / Non-Goals

**Goals :**
- Zéro échec unitaire dû à la charge du runner, sans délai écrit test par test.
- Chaque contrôle tourne au moment où son résultat peut encore bloquer la fusion : avant la fusion pour tout ce qui vérifie le code, après seulement pour ce qui publie.
- Le chemin critique d'une PR de code est la tranche e2e la plus lente ; le réduire.

**Non-Goals :**
- Toucher la classification des fichiers de documentation sur les PR (elle marche : PR de release en 26 s).
- CodeQL : la configuration par défaut ne prend pas de filtre de chemins. La passer en configuration avancée pour sauter environ 1 min non bloquante sur les PR de documentation ajouterait un workflow et des actions à pinner ; le gain ne le justifie pas.
- Cache des navigateurs Playwright (30 à 50 s par tranche) et des paquets apt : déjà écartés par `improve-ci-pipeline`, mesures inchangées.

## Decisions

### 1. Deux projets Vitest au lieu de délais par test

`vitest.config.ts` déclare deux projets :

- `unit` : tout `tests/**/*.test.ts(x)` sauf les fichiers lourds, parallélisme par défaut, `sequence.groupOrder: 0`.
- `heavy` : la liste explicite des 11 fichiers lourds (Tesseract, sharp, scrypt), `maxWorkers: 1`, `testTimeout: 60_000`, `sequence.groupOrder: 1`. Vitest lance les groupes l'un après l'autre : quand `heavy` tourne, rien d'autre n'occupe les processeurs.

Les `}, 60_000)` disparaissent des fichiers lourds. Un fichier lourd ajouté plus tard sans être listé tombe dans `unit` ; un test `tests/vitest-projects.test.ts` lit le projet `unit` et échoue si l'un de ses fichiers importe `sharp`, `node:child_process` avec `tesseract`, ou `scryptSync` (liste de motifs écrite à la main).

Alternatives écartées : `--no-file-parallelism` pour toute la suite (plus de 100 fichiers rapides passeraient en série) ; relancer les tests en échec (`retry`) qui masquerait aussi les vrais échecs ; augmenter le délai global à 60 s (ne règle pas le budget de CPU ni la contention).

### 2. Budget de la détection de panneau mesuré seul

Le test `détecte la référence en moins de 2 s` mesure `process.cpuUsage()`, qui compte tout le processus, fils de libvips compris. Dans le groupe `heavy` avec `maxWorkers: 1`, le processus ne fait plus que ce test pendant la mesure. Le budget reste à 2 s : une régression d'un ordre de grandeur doit toujours le faire rougir. S'il dépasse encore en CI après la décision 1, on le passe en `it.skipIf(process.env.CI)` avec un commentaire qui cite l'exécution, plutôt que de monter le seuil.

### 3. `main` saute ce que la PR a déjà prouvé

Avec `strict: true` et `enforce_admins: true`, tout commit sur `main` arrive par une PR à jour dont les contrôles requis sont verts, et l'arbre fusionné est celui que la PR a testé, quel que soit le mode de fusion. Le job `scope`, sur `push`, vérifie au lieu de supposer :

1. `gh api repos/{repo}/commits/$TO/pulls` → numéro et `head.sha` de la PR (la première dont `merged_at` est renseigné).
2. `gh run list --workflow pr.yml --commit <head.sha> --json conclusion` → `success` attendu.
3. `git rev-parse $TO^{tree}` égal à `git rev-parse <head.sha>^{tree}`.
4. `git merge-base --is-ancestor $FROM <head.sha>` : la PR contenait le commit précédent de `main`.

Les quatre lectures alimentent un nouvel argument de `scripts/ci-scope.ts` (`--verified-by-pr`), qui sort `code=false` seulement si tout tient. Le classement « documentation » n'est plus appliqué sur `push` et `--parent-conclusion` disparaît. Les tests de `ci-scope.ts` couvrent chaque condition manquante (valeurs écrites à la main).

`release-please` garde `needs: checks` ; les jobs sautés comptent comme réussis pour `needs`, comme aujourd'hui sur les pushs de documentation.

Alternatives écartées : garder la suite complète sur `main` (5 machines et environ 5 min pour rejouer un résultat connu) ; sauter sans rien vérifier (un push par un administrateur qui désactive la protection passerait sans contrôle).

### 4. Docker sur les PR, plus sur `main`

`pr.yml` passe `docker: true`. `main.yml` garde `docker: true`, et la décision 3 saute le job quand l'arbre est déjà vérifié : il ne tourne sur `main` que dans le cas de repli. Sur une PR, il tourne en parallèle des tranches e2e et ne rallonge pas le chemin critique (166 à 255 s contre 280 à 340 s pour la tranche 2).

Cache : un cache `gha` écrit depuis une PR n'est lisible que par cette PR et sa branche de base. `docker` lit donc `golf-handicaps` (son propre scope) puis `golf-handicaps-amd64` (écrit par `publish-image` sur `main` à chaque release), pour démarrer chaud sur une nouvelle PR.

`checks / docker` devient un contrôle requis (tâche humaine dans la protection de `main`). Sauté pour la documentation, il compte comme réussi, comme `checks / e2e` aujourd'hui.

### 5. Un build Next partagé par les tranches

Nouveau job `e2e-build` : setup, `pnpm build`, puis artefact `next-build` avec `.next/` sans `cache/` ni `dev/` (environ 80 Mo d'après le build local), rétention 1 jour. `e2e-shard` prend `needs: [scope, e2e-build]`, télécharge l'artefact, et `playwright.config.ts` lance `pnpm start` au lieu de `pnpm build && pnpm start` quand `E2E_PREBUILT=1` (posé seulement dans le job). En local, rien ne change. `e2e` (agrégateur) ajoute `e2e-build` à ses `needs` et à son contrôle de résultat.

Le build ne sort plus du temps de chaque tranche, il part avant elles : le gain sur le chemin critique est le temps de build moins le téléchargement de l'artefact, à mesurer (tâche 4.3). Si le gain est inférieur à 20 s, on revient en arrière.

### 6. Équilibre des tranches

La tranche 2 prend deux fois plus que les autres sur toutes les exécutions relevées. `--shard` coupe par nombre de tests, pas par durée. La cause se mesure avant de choisir : le reporter `json` (déjà évoqué par `improve-ci-pipeline`) donne la durée de chaque test et sa tranche. Selon le résultat : déplacer ou découper le fichier lent (le plus probable : les parcours d'import qui attendent le worker OCR), ou passer à 4 tranches. Le critère est fixé dans la spec (écart < 30 %).

### 7. Lien de l'image dans la release

`publish-manifest` sort le digest de l'index (`docker buildx imagetools inspect "$IMAGE_NAME:$TAG" --format '{{json .Manifest}}' | jq -r .digest`). Nouveau job `release-notes` (`needs: [release-please, publish-manifest]`, même condition `release_created`, permission `contents: write` seule) :

1. `gh release view "$TAG" --json body --jq .body` → notes de release-please.
2. Ajout d'une section `## Image Docker` : `ghcr.io/<owner>/golf-handicaps:vX.Y.Z`, digest, bloc ```` ```sh docker pull … ``` ````, lien `https://github.com/<owner>/golf-handicaps/pkgs/container/golf-handicaps`.
3. `gh release edit "$TAG" --notes-file …`.

La section n'est ajoutée que si le corps ne contient pas déjà `## Image Docker` : une relance du job ne la duplique pas. Le job tourne après la publication, donc la release ne pointe jamais vers une image absente.

Alternative écartée : passer le texte à release-please (il écrit la release avant que l'image existe).

### 8. Hooks lefthook filtrés

- `typecheck` (pre-commit) : `glob: "*.{ts,tsx}"`.
- `test` et `jscpd` (pre-push) : `glob` sur `src/**`, `tests/**`, `scripts/**`, `vitest.config.ts`, `.jscpd.json`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json`. lefthook 2 applique `glob` aux fichiers des commits poussés en pre-push.

## Risks / Trade-offs

- [`main` saute les tests sur la foi d'une exécution PR] → quatre conditions vérifiées, repli sur la suite complète au moindre doute, et `enforce_admins: true` empêche le contournement ordinaire. Si la protection est un jour assouplie, la condition 4 (PR à jour) et la 3 (arbre identique) gardent la règle juste.
- [Groupe `heavy` en série plus lent] → mesure à la tâche 1.4 : `Tests unitaires` doit rester sous 150 s ; au-delà, essayer `maxWorkers: 2`.
- [Fichier lourd oublié dans `unit`] → test de garde de la décision 1.
- [Artefact `.next` incomplet pour `next start`] → la tâche 4.2 lance une tranche sur l'artefact seul ; un fichier manquant se voit au premier test.
- [Cache Docker froid sur les PR] → premier build d'une PR plus lent (jusqu'à 140 s mesurés), toujours sous la tranche e2e la plus lente.
- [Une PR de plus par contrôle requis] → ajouter `checks / docker` à la protection après la fusion de ce change, pas avant : sinon les PR ouvertes avant attendraient un contrôle qui ne vient jamais.

## Migration Plan

1. Archiver `improve-ci-pipeline` (son implémentation est sur `main` depuis #14) pour que `openspec/specs/ci-pipeline` existe.
2. Fusionner ce change par PR ; sa propre exécution `pr` lance `docker` pour la première fois.
3. Ajouter `checks / docker` aux contrôles requis de `main`.
4. Retour arrière : revert de la PR ; retirer `checks / docker` des contrôles requis avant le revert.

## Open Questions

- Cause exacte du déséquilibre de la tranche 2 : se lit dans le rapport `json` de la tâche 5.1 ; la spec fixe déjà le critère.
