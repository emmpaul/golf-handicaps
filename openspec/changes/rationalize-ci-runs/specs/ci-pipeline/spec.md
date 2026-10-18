# Spec Delta

## MODIFIED Requirements

### Requirement: Suite complète pour tout changement de code
Une PR qui modifie au moins un fichier qui n'est pas de la documentation SHALL lancer tous les contrôles : commitlint, `check:pins`, lint, typecheck, tests unitaires, jscpd, e2e, build Docker et test de fumée compose. Un push sur `main` dont l'arbre n'a pas déjà été vérifié par une PR (voir « Push sur main déjà vérifié par sa PR ») SHALL lancer les mêmes contrôles.

#### Scenario: Un fichier de code parmi des fichiers de documentation
- **WHEN** une PR modifie `openspec/changes/x/tasks.md` et `src/lib/env.ts`
- **THEN** les jobs `checks / quality`, `checks / e2e` et `checks / docker` lancent toutes leurs étapes

#### Scenario: Changement de workflow
- **WHEN** une PR ne modifie que `.github/workflows/checks.yml`
- **THEN** la suite complète tourne, build Docker et test de fumée compris

#### Scenario: Changement de lockfile
- **WHEN** une PR ne modifie que `pnpm-lock.yaml`
- **THEN** la suite complète tourne

### Requirement: Push de documentation ou de release sur main
Un push sur `main` SHALL sauter les étapes lourdes de `checks / quality`, les e2e, le build Docker et le test de fumée compose quand son arbre a déjà été vérifié par une PR. Le classement des fichiers en documentation ne s'applique plus aux pushs sur `main`, et la conclusion de l'exécution `main` du commit parent n'entre plus dans la décision. Le sujet du commit n'entre jamais dans la décision.

#### Scenario: Fusion de la PR de release
- **WHEN** la PR de release `0.6.0`, dont l'exécution `pr` a réussi, est fusionnée sur `main`
- **THEN** `checks / e2e` et `checks / docker` sont sautés, `release-please` crée le tag `v0.6.0`, et `publish-image` puis `publish-manifest` poussent l'image `v0.6.0`

#### Scenario: Push de documentation après un push rouge
- **WHEN** une PR verte qui ne modifie que `openspec/` est fusionnée et que l'exécution `main` du commit parent a échoué
- **THEN** les étapes lourdes sont sautées, puisque l'arbre fusionné est celui que la PR a vérifié

#### Scenario: Sujet de release sur un commit de code
- **WHEN** un commit intitulé `chore(main): release 0.6.0` qui modifie `src/lib/env.ts` arrive sur `main` sans PR associée
- **THEN** la suite complète tourne

### Requirement: PR fusionnable quand des jobs sont sautés
Les contrôles requis par la protection de `main`, `checks / quality`, `checks / e2e` et `checks / docker`, SHALL toujours rendre un résultat sur une PR, y compris quand ses jobs lourds sont sautés. Une PR de documentation seule dont les contrôles légers passent MUST être fusionnable sans contournement par un administrateur.

#### Scenario: PR de documentation fusionnable
- **WHEN** une PR ne modifie que `openspec/` et que commitlint passe
- **THEN** `checks / quality` est réussi, `checks / e2e` et `checks / docker` sont sautés, et le bouton de fusion est disponible

#### Scenario: Commit mal formé sur une PR de documentation
- **WHEN** une PR ne modifie que `openspec/` avec un commit `bad message`
- **THEN** `checks / quality` échoue sur commitlint et la PR n'est pas fusionnable

#### Scenario: Image cassée sur une PR de code
- **WHEN** une PR modifie le `Dockerfile` de sorte que `docker compose up --wait` n'atteint jamais l'état sain
- **THEN** `checks / docker` échoue et la PR n'est pas fusionnable

### Requirement: Délai des tests unitaires qui lancent Tesseract
Un test unitaire qui lance le binaire Tesseract, encode une image avec sharp ou calcule scrypt MUST NOT échouer en CI parce que d'autres fichiers de test occupent les processeurs du runner. Ces tests MUST NOT porter chacun leur propre délai : un délai commun s'applique à tout le groupe.

#### Scenario: Lecture Tesseract sur un runner lent
- **WHEN** la lecture de la case INDEX du trou 2 par le binaire Tesseract prend 6 s
- **THEN** le test passe

#### Scenario: Conversion WebP pendant les autres tests
- **WHEN** `pnpm test` tourne en CI sur un runner à 4 vCPU
- **THEN** le test `toStoredWebp > convertit un JPEG en WebP` et les tests `attemptLogin` qui font 11 calculs scrypt passent sans dépasser leur délai

### Requirement: E2e répartis sur trois machines
Les e2e d'une PR ou d'un push de code SHALL tourner en trois tranches, chacune sur sa propre machine avec son serveur et sa base : la tranche `ocr` lance les tests tagués `@ocr`, les tranches `1` et `2` se partagent les autres par `--shard`. Chaque test des projets Chromium et WebKit iPhone MUST tourner exactement une fois en tout, toutes tranches confondues. Le contrôle `checks / e2e` réunit toutes les tranches : il réussit si toutes réussissent, échoue si l'une échoue ou est annulée, et est sauté pour un changement de documentation.

#### Scenario: Trois tranches vertes
- **WHEN** une PR modifie `src/` et que les trois tranches passent
- **THEN** `checks / e2e-shard (ocr)`, `checks / e2e-shard (1)`, `checks / e2e-shard (2)` et `checks / e2e` sont réussis, et la somme des tests passés des trois tranches vaut le nombre de tests de `pnpm exec playwright test --list`

#### Scenario: Chaque test dans une seule tranche
- **WHEN** on liste les tests de chaque tranche avec ses arguments (`--list --grep @ocr`, puis `--list --grep-invert @ocr --shard=1/2` et `--shard=2/2`)
- **THEN** la réunion des trois listes contient chaque test de `pnpm exec playwright test --list` une fois et une seule

#### Scenario: Une tranche rouge
- **WHEN** un test e2e échoue dans la tranche `ocr`
- **THEN** `checks / e2e` finit en échec et la PR n'est pas fusionnable

#### Scenario: Documentation seule
- **WHEN** une PR ne modifie que `openspec/`
- **THEN** les tranches et `checks / e2e` sont sautés

## ADDED Requirements

### Requirement: Push sur main déjà vérifié par sa PR
Un push sur `main` SHALL être considéré comme déjà vérifié seulement si les trois conditions tiennent : le commit poussé appartient à une PR dont l'exécution `pr` a réussi sur son dernier commit, l'arbre du commit poussé est identique à celui de ce dernier commit, et ce dernier commit contient le commit précédent de `main`. Si une condition manque ou ne peut être lue, la suite complète MUST tourner.

#### Scenario: Fusion par squash d'une PR verte et à jour
- **WHEN** une PR verte et à jour qui modifie `src/` est fusionnée par squash
- **THEN** `checks / e2e` et `checks / docker` sont sautés et le log de `scope` nomme le numéro de la PR et le commit dont l'exécution `pr` a réussi

#### Scenario: PR rouge fusionnée par un contournement
- **WHEN** un commit arrive sur `main` depuis une PR dont la dernière exécution `pr` a échoué
- **THEN** la suite complète tourne

#### Scenario: Arbre différent
- **WHEN** l'arbre du commit poussé diffère de celui du dernier commit de sa PR
- **THEN** la suite complète tourne

#### Scenario: API indisponible
- **WHEN** la lecture de la PR associée ou de son exécution `pr` échoue
- **THEN** la suite complète tourne

### Requirement: Un seul build de l'app pour les e2e
Les e2e d'une PR ou d'un push de code SHALL tourner contre une seule construction de l'app, partagée par toutes les tranches. Une tranche MUST NOT reconstruire l'app.

#### Scenario: Trois tranches, un build
- **WHEN** une PR modifie `src/`
- **THEN** le log d'aucune tranche `checks / e2e-shard (n)` ne contient la sortie de `next build`

#### Scenario: Build en échec
- **WHEN** le build de l'app échoue
- **THEN** les tranches ne tournent pas et `checks / e2e` finit en échec

### Requirement: Tranches e2e équilibrées
Sur une exécution de code, l'étape « Tests e2e » de la tranche la plus lente SHALL durer au plus 30 % de plus que celle de la plus rapide. La répartition des tests entre tranches MUST tenir compte de leur durée, pas seulement de leur nombre.

#### Scenario: Durées des tranches
- **WHEN** une PR de code fait passer toutes les tranches
- **THEN** la plus longue étape « Tests e2e » dépasse la plus courte de moins de 30 %

### Requirement: Image Docker indiquée dans la release
À la création d'une release, la release GitHub `vX.Y.Z` SHALL garder les notes générées par release-please et recevoir en plus une section « Image Docker » avec la référence `ghcr.io/<owner>/golf-handicaps:vX.Y.Z`, le digest de l'index multi-arch publié, la commande `docker pull` correspondante et le lien vers la page du paquet sur GitHub. Un échec de cette mise à jour MUST faire échouer l'exécution `main`.

#### Scenario: Release publiée
- **WHEN** la PR de release `0.6.0` est fusionnée et que l'index multi-arch est poussé
- **THEN** `gh release view v0.6.0` affiche les notes du CHANGELOG puis une section « Image Docker » contenant `docker pull ghcr.io/emmpaul/golf-handicaps:v0.6.0` et le digest `sha256:` que `docker buildx imagetools inspect ghcr.io/emmpaul/golf-handicaps:v0.6.0` renvoie

#### Scenario: Pas de release
- **WHEN** un push sur `main` ne crée pas de release
- **THEN** aucune release n'est modifiée

### Requirement: Hooks locaux limités au code
Les hooks Git locaux SHALL lancer le typecheck au commit seulement si un fichier TypeScript est indexé, et les tests unitaires et jscpd au push seulement si un fichier sous `src/`, `tests/` ou `scripts/`, ou un fichier de configuration de ces outils, fait partie des commits poussés.

#### Scenario: Commit de documentation
- **WHEN** on commit seulement `openspec/changes/x/tasks.md`
- **THEN** lefthook saute le typecheck

#### Scenario: Push de code
- **WHEN** on pousse un commit qui modifie `src/lib/env.ts`
- **THEN** lefthook lance `pnpm test` et `pnpm jscpd`
