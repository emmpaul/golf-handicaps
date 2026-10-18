# Proposal

## Why

L'historique GitHub Actions du 17/10/2026 (30 exécutions, de 39053454318 à 39064931391) montre que la CI tourne en entier là où elle n'apporte rien et qu'elle est lente là où elle compte. 10 des 30 exécutions ne touchaient que `openspec/` ou des `.md`, et chacune a lancé lint, typecheck, tests unitaires, e2e (4 à 5 min) et, sur `main`, le build Docker et le test de fumée. Manu a même annulé l'une d'elles à la main (39063834376). La PR de release, qui ne change qu'une version et le CHANGELOG, a pris la suite complète deux fois (39063515183, 39063852764), puis sa fusion l'a relancée 4,4 min avant la publication (39064366413). Le job de publication d'une release prend 6 à 10 min (39064366413, 39056539603), dont 2 à 5 min de `pnpm build` arm64 sous émulation QEMU. Le contrôle e2e, le plus long (médiane 261 s), fait passer 57 tests un par un sur une seule machine. Enfin, un test OCR unitaire a fait échouer 2 des 23 lancements de `pnpm test` en CI, sur un dépassement du délai de 5 s, et il a fallu relancer.

## What Changes

- Une PR qui ne touche que de la documentation (`openspec/`, `docs/`, fichiers `*.md`) lance seulement les contrôles légers (commitlint, `check:pins`, lint). Les e2e, les tests unitaires, le typecheck et jscpd sont sautés. Les contrôles requis `checks / quality` et `checks / e2e` rendent quand même un résultat, et la PR reste fusionnable.
- La PR de release compte comme de la documentation : `CHANGELOG.md`, `.release-please-manifest.json` et `package.json` quand seul son champ `version` change. Tout autre changement de `package.json` lance la suite complète.
- Sur `main`, un push de documentation, dont la fusion de la PR de release, saute aussi les e2e, le build Docker et le test de fumée, mais seulement si l'exécution `main` du commit parent a réussi. Le push de release va donc directement à release-please puis à la publication. Le classement lit les fichiers et le contenu de `package.json`, jamais le sujet du commit.
- Si la CI ne parvient pas à classer un changement, elle lance tout. Un contrôle requis n'est jamais sauté par erreur.
- Tout autre chemin (code, tests, dépendances, lockfile, `.github/`, Dockerfile, config) lance la suite complète, comme aujourd'hui.
- Les e2e tournent en trois tranches sur trois machines, chacune avec son serveur et sa base. Playwright découpe la liste test par test (`fullyParallel: true`, toujours `workers: 1`), pas fichier par fichier. Un job agrégateur garde le nom du contrôle requis `checks / e2e` : il échoue si une tranche échoue, et il est sauté pour la documentation.
- L'image arm64 se construit sur un runner arm64 natif au lieu de QEMU, puis les deux images sont réunies sous les mêmes tags `vX.Y.Z`, `latest` et `sha`.
- Les tests unitaires qui lancent le vrai binaire Tesseract ont un délai adapté à un runner lent, et ne dépendent plus du délai par défaut de 5 s.
- Les e2e qui ne passent qu'à la deuxième tentative sont signalés par leur nom dans le résumé de l'exécution, sans la faire échouer.
- Les enregistrements de build Docker (`*.dockerbuild`) ne sont plus gardés 90 jours comme artefacts.
- L'option « Require branches to be up to date before merging » reste cochée : la garde du push de release en dépend. Les relances « Update branch » sont un coût accepté. Tâche humaine : vérifier après la mise en place que les contrôles requis restent exactement `checks / quality` et `checks / e2e`, et que l'option est toujours cochée.

## Capabilities

### New Capabilities

- `ci-pipeline` : ce que la CI garantit sur les PR et sur `main` : quels contrôles tournent selon les fichiers modifiés, le traitement de la PR et du push de release, le repli sur la suite complète, la fusionnabilité d'une PR dont des jobs sont sautés, la répartition des e2e, l'annulation des exécutions remplacées, la publication multi-arch et le signalement des tests instables.

### Modified Capabilities

Aucune. Les specs fonctionnelles de l'app ne changent pas.

## Impact

- **Workflows** : `.github/workflows/checks.yml` (job `scope`, conditions de repli sur les jobs et les étapes lourdes, tranches `e2e-shard` et agrégateur `e2e`, variables d'environnement de `docker/build-push-action`), `.github/workflows/main.yml` (permission `actions: read` pour la garde, condition de release-please si besoin, job `publish` découpé par architecture puis fusion du manifeste). `.github/workflows/pr.yml` ne change pas.
- **Script** : nouveau `scripts/ci-scope.ts` (classement des fichiers, comparaison des deux `package.json`, garde sur `main`) et ses tests `tests/scripts/ci-scope.test.ts`.
- **Tests** : `tests/ocr/tesseract-reader.test.ts`, `tests/ocr/read-scorecard.test.ts`, `tests/jobs/ocr-scorecard.test.ts` pour le délai ; `playwright.config.ts` pour `fullyParallel: true`, et pour le reporter `json` si le signalement des tests instables en a besoin.
- **Réglages GitHub** (humain) : aucun changement, seulement une vérification de la protection de `main`.
- **Coût** : moins de minutes de runner pour la documentation et les releases, deux machines de plus par PR de code pour les tranches e2e 2 et 3. Les runners standard et `ubuntu-24.04-arm` sont gratuits pour un repo public.
- **Hors périmètre** : plusieurs workers Playwright sur une machine (`workers: 1` reste), le cache `.next/cache`, le cache des navigateurs Playwright et des paquets apt. Les mesures sont dans `design.md`.
- **Dépendance** : aucune nouvelle action de détection de chemins, aucune dépendance npm.
