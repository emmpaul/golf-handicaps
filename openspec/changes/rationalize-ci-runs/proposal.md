# Proposal

## Why

Le premier passage (`improve-ci-pipeline`, #14) a retiré la suite complète des PR de documentation et accéléré la publication, mais la CI échoue encore souvent et refait du travail au mauvais moment. Sur les 8 exécutions `pr` rouges depuis, 6 viennent de `pnpm test` et aucune d'un vrai bug : des tests qui lancent Tesseract, sharp ou scrypt dépassent leur délai (5 s ou 60 s) ou un budget de temps (`détecte la référence en moins de 2 s`, 2,8 s de CPU mesurées en CI). La branche `feat/auto-detect-scorecard-corners` a pris 4 exécutions rouges d'affilée (39129548836, 39133073343, 39135633772, 39136135655) avant de passer sans changement de code de production lié. Chaque correction a ajouté un délai test par test (63 `}, 60_000)` dans `tests/`), sans traiter la cause : ces fichiers tournent en parallèle et se disputent les 4 vCPU du runner.

En relisant chaque exécution, plusieurs contrôles tournent à un moment où ils n'apportent rien, ou trop tard :

- **Le push sur `main` refait les tests de la PR.** La protection de `main` exige une branche à jour (`strict: true`, admins inclus) : l'arbre fusionné est exactement celui que la PR vient de tester. `main` relance pourtant `quality` et les trois tranches e2e (39130… : 166 s, 168 s, 278 s, 230 s) avant release-please.
- **Le build Docker et le test de fumée compose ne tournent qu'après la fusion.** Une PR qui casse le `Dockerfile`, le build standalone ou le worker esbuild passe au vert et casse `main`, quand on ne peut plus que corriger par une nouvelle PR.
- **Chaque tranche e2e reconstruit l'app.** Le `webServer` Playwright lance `pnpm build` sur les trois machines, et la tranche 2 met deux fois plus de temps que les autres (206 à 260 s contre 90 à 115 s), ce qui fixe la durée de toute la PR.
- **Les hooks locaux** lancent `pnpm typecheck` à chaque commit et `pnpm test` + `pnpm jscpd` à chaque push, même pour un commit qui ne touche que `openspec/`.

Enfin, la release GitHub ne dit pas où trouver l'image Docker publiée : il faut connaître GHCR et deviner le tag.

## What Changes

- **Tests unitaires stables.** Les fichiers de test lourds en CPU (Tesseract, sharp, scrypt) tournent dans un groupe Vitest à part, un fichier à la fois, avec un délai commun ; les autres restent en parallèle. Les délais posés test par test disparaissent. Le budget de performance de la détection de panneau ne compte plus le CPU des autres fichiers.
- **`main` ne refait pas ce que la PR a prouvé.** Sur un push `main`, si le commit vient d'une PR dont l'exécution `pr` a réussi sur un arbre identique, `quality` lourd, les e2e et le build Docker sont sautés : le push va directement à release-please. Sinon (push hors PR, arbre différent, API indisponible), la suite complète tourne. Cette règle remplace la garde « exécution `main` du commit parent réussie » du premier passage.
- **Docker vérifié avant la fusion.** Le build de l'image (sans push) et le test de fumée compose tournent sur les PR de code, en parallèle des e2e. `checks / docker` devient un contrôle requis (réglage GitHub, tâche humaine). Il reste sauté pour la documentation.
- **Un seul build Next par PR pour les e2e**, partagé par les trois tranches, et une répartition des tests qui ramène la tranche la plus lente à moins de 30 % au-dessus de la plus rapide.
- **Hooks locaux ciblés.** `typecheck` au commit, `test` et `jscpd` au push ne tournent que si des fichiers de code sont concernés.
- **Lien de l'image dans la release.** Après la publication, la release GitHub `vX.Y.Z` reçoit une section « Image Docker » : la référence `ghcr.io/<owner>/golf-handicaps:vX.Y.Z`, le digest de l'index multi-arch, la commande `docker pull` et le lien vers la page du paquet GHCR.
- **Inchangé, après relecture** : l'analyse CodeQL (configuration par défaut de GitHub, environ 1 min, non bloquante) continue de tourner sur toutes les PR ; la PR de release garde son contrôle léger (26 s) ; `concurrency` de `pr.yml` et `main.yml` ne change pas.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `ci-pipeline` : quand le push sur `main` saute les contrôles (arbre déjà vérifié par la PR au lieu de la garde sur le commit parent), le build Docker et le test de fumée passent des pushs `main` aux PR, stabilité des tests unitaires lourds en CPU, build e2e unique, contenu de la release GitHub. La spec vient de `improve-ci-pipeline`, qu'il faut archiver avant ce change (voir `tasks.md`).

## Impact

- **Workflows** : `.github/workflows/checks.yml` (job `build` partagé par les tranches e2e, `docker` sur les PR, entrée et logique de `scope` pour `main`), `.github/workflows/main.yml` (`docker: false`, permissions de `scope`, job de mise à jour de la release), `.github/workflows/pr.yml` (entrée `docker`).
- **Script** : `scripts/ci-scope.ts` et `tests/scripts/ci-scope.test.ts` (règle « arbre déjà vérifié » à la place de `--parent-conclusion`).
- **Tests** : `vitest.config.ts` (deux projets), les 11 fichiers lourds de `tests/` (retrait des délais par test), `tests/ocr/detect-panel.test.ts` (mesure du budget), `playwright.config.ts` (serveur web sans `pnpm build` quand l'app est déjà construite).
- **Hooks** : `lefthook.yml`.
- **Réglages GitHub (humain)** : ajouter `checks / docker` aux contrôles requis de `main`, garder `strict: true`.
- **Coût** : une machine de plus par PR de code (`docker`), une de moins par push `main` de code (plus de `quality`, e2e ni `docker` après une PR verte), un build Next au lieu de trois par PR.
- **Hors périmètre** : CodeQL en configuration avancée, cache des navigateurs Playwright et des paquets apt, plusieurs workers Playwright par machine.
