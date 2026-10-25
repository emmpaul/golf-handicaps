## MODIFIED Requirements

### Requirement: Carte de score d'un round
La page d'un round SHALL afficher, sous le classement net, la carte de score du round : une colonne par trou (1 à 18) avec les totaux OUT, IN et TOT, et une ligne pour le par, l'index de trou et chaque joueur du round dans l'ordre de la carte. Les scores des joueurs portent les marques de score (spec `visual-theme`). Sous 768 px, la carte MUST présenter l'aller (trous 1 à 9 et OUT) puis le retour (trous 10 à 18, IN et TOT) en deux blocs empilés, sans défilement horizontal.

#### Scenario: Carte du round de référence
- **WHEN** l'utilisateur ouvre le round BETHPAGE BLACK / Red du 17 octobre 2026
- **THEN** la carte montre pour Gab « 5 » au trou 1, « 38 » en OUT, « 34 » en IN et « 72 » en TOT, et pour Manu « 88 » en TOT

#### Scenario: Marques sur la carte
- **WHEN** la carte du round de référence s'affiche
- **THEN** le score « 4 » de Gab au trou 7 (par 5) porte la marque birdie et son « 5 » au trou 1 (par 4) la marque bogey

#### Scenario: Carte sur téléphone
- **WHEN** l'utilisateur ouvre à 320 puis 390 px un round de 4 joueurs
- **THEN** la carte montre un bloc aller (trous 1 à 9, OUT) au-dessus d'un bloc retour (trous 10 à 18, IN, TOT), les libellés « Par », « Index » et les quatre noms sont visibles dans chaque bloc, et ni la carte ni la page ne défilent horizontalement

## ADDED Requirements

### Requirement: En-tête d'un round
La page d'un round SHALL afficher sous le nom du parcours les tees, la date et le par comme éléments distincts, sans les joindre par des points médians. La liste des rounds MUST suivre la même règle pour le parcours et les tees.

#### Scenario: En-tête du round de référence
- **WHEN** l'utilisateur ouvre le round BETHPAGE BLACK / Red du 17 octobre 2026
- **THEN** l'en-tête montre « Tees Red », « 17 octobre 2026 » et « Par 71 », et son texte ne contient pas « · »

#### Scenario: Ligne de la liste
- **WHEN** l'utilisateur ouvre la liste des rounds
- **THEN** la ligne du round de référence montre « BETHPAGE BLACK » et « Red » sans « · » entre eux

### Requirement: Classement lisible sur téléphone
Le classement net d'un round SHALL montrer toutes ses colonnes (joueur, brut, handicap de jeu, net, rang) sans en couper aucune sur un écran de 320 px, et la page MUST NOT défiler horizontalement.

#### Scenario: Classement à 320 px
- **WHEN** l'utilisateur ouvre à 320 px un round de Manu et Sean où les deux ont un index
- **THEN** les en-têtes « Brut », « Net » et « Rang » et leurs valeurs sont entièrement visibles sans défilement horizontal
