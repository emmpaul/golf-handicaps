# Spec Delta

## Purpose

Décrire ce que le dépôt fournit à un contributeur sur sa machine : des réglages d'éditeur alignés sur le formateur, des données locales où l'app montre ses écrans complets, et la documentation pour lancer vite les e2e et déboguer le worker.

## ADDED Requirements

### Requirement: Réglages d'éditeur partagés
Le dépôt SHALL contenir à sa racine un `.editorconfig` qui donne, pour tous les fichiers, l'encodage UTF-8, les fins de ligne LF, un retour à la ligne final, une indentation par espaces et la même taille d'indentation et la même largeur de ligne que le formateur de `biome.json`.

#### Scenario: Valeurs alignées sur le formateur
- **WHEN** un contributeur ouvre un fichier du dépôt dans un éditeur qui lit `.editorconfig`
- **THEN** l'éditeur indente par 2 espaces, termine les lignes en LF et marque la largeur 100, comme `pnpm format`

#### Scenario: Formateur modifié seul
- **WHEN** la taille d'indentation ou la largeur de ligne de `biome.json` change sans que `.editorconfig` change
- **THEN** `pnpm test` échoue

### Requirement: Historique de rounds dans la base locale
`pnpm db:reset` SHALL créer, en plus du round de référence `IMG_3064`, des rounds plus anciens qui donnent à Gab et Manu au moins 3 rounds chacun et à Sean 1 ou 2 rounds. Le round de référence MUST rester le round le plus récent, et chaque round créé MUST passer les contrôles de cohérence d'un round.

#### Scenario: Index définitifs et provisoire
- **WHEN** un développeur lance `pnpm db:reset` puis ouvre la page des index
- **THEN** Gab et Manu ont un index sans la mention « provisoire », et Sean un index avec la mention « provisoire »

#### Scenario: Courbes à plusieurs points
- **WHEN** un développeur lance `pnpm db:reset` puis ouvre la courbe de Gab
- **THEN** la courbe montre un point par round de Gab, à la date de chacun de ces rounds

#### Scenario: Round de référence en tête
- **WHEN** un développeur lance `pnpm db:reset` puis ouvre la liste des rounds
- **THEN** le premier round listé est BETHPAGE BLACK / Red du 2026-10-17, avec Gab 72 et Manu 88

### Requirement: E2E rapides documentés
`docs/development.md` SHALL expliquer comment lancer les e2e sans refaire le build à chaque fois, comment n'en lancer qu'une partie (un fichier de spec, un projet, un titre de test), et quand le build doit être refait.

#### Scenario: Un seul fichier de spec
- **WHEN** un contributeur suit `docs/development.md` pour relancer un seul fichier de spec après un premier build
- **THEN** la commande documentée lance ce fichier sans lancer `pnpm build`

### Requirement: Débogage du worker documenté
`docs/development.md` SHALL expliquer comment lire l'état de la file de jobs et des imports dans la base locale, comment relancer un import en échec, et comment lancer le worker seul avec un débogueur attaché.

#### Scenario: Import en échec
- **WHEN** un contributeur voit un import en « Échec » et suit `docs/development.md`
- **THEN** il trouve la requête qui affiche l'erreur du job de cet import et la façon de le remettre dans la file

#### Scenario: Débogueur sur le worker
- **WHEN** un contributeur suit `docs/development.md` pour déboguer le worker
- **THEN** la commande documentée démarre le worker avec l'inspecteur Node ouvert, en lisant `.env` et `.env.local` comme `pnpm dev`
