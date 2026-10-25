# rounds Specification

## Purpose
Garder l'historique des rounds joués, permettre de les consulter, de les corriger et de les supprimer, et afficher le classement net de chaque round.

## Requirements

### Requirement: Contenu d'un round
Un round enregistré SHALL contenir : le parcours, les tees, la date, et pour chacun des 18 trous le par, l'index et la distance (facultative). Il contient aussi, pour 1 à 4 joueurs distincts, les 18 scores bruts. Le round garde ses propres valeurs de par et d'index, même si un autre round sur le même parcours a des valeurs différentes.

#### Scenario: Round de référence
- **WHEN** la carte `IMG_3064` est enregistrée avec Gab et Manu
- **THEN** le round affiche Bethpage Black, tees Red, 17 octobre 2026, par 71, Gab 72 brut et Manu 88 brut

### Requirement: Parcours connus
Le système SHALL identifier un parcours par son nom et ses tees, sans tenir compte de la casse. Les valeurs de référence d'un parcours (pars, index, distances) sont celles du round le plus récent joué sur ce parcours et ces tees.

#### Scenario: Même parcours, autres tees
- **WHEN** des rounds existent sur « Bethpage Black / Red » et « Bethpage Black / Blue »
- **THEN** la liste des parcours connus contient ces deux entrées séparées

### Requirement: Liste des rounds
Le système SHALL afficher la liste des rounds, du plus récent au plus ancien par date de jeu. Pour chaque round, la liste montre la date, le parcours, les joueurs avec leur score brut, et le gagnant net.

#### Scenario: Ordre de la liste
- **WHEN** des rounds existent le 2026-10-10 et le 2026-10-17
- **THEN** le round du 2026-10-17 apparaît en premier

### Requirement: Classement net d'un round
Pour chaque joueur d'un round, le système SHALL afficher le brut, le handicap de jeu, le net et le rang net. Le handicap de jeu est l'index du joueur juste avant ce round, arrondi à l'entier le plus proche (0,5 arrondi vers le haut). Le net vaut brut moins handicap de jeu. Des nets égaux partagent le même rang.

#### Scenario: Classement net à deux
- **WHEN** Gab a un index de 1,0 et Manu de 17,4 avant un round où Gab joue 72 et Manu 88
- **THEN** Gab a un handicap de jeu de 1 et un net de 71, Manu de 17 et un net de 71, et les deux sont premiers ex æquo

#### Scenario: Joueur sans index
- **WHEN** un joueur joue son tout premier round
- **THEN** son net s'affiche « — » avec la mention « pas encore d'index », et il n'est pas classé en net

### Requirement: Correction d'un round enregistré
Le système SHALL permettre de modifier un round enregistré (parcours, tees, date, par, index, distances, scores, joueurs), avec le même écran et les mêmes contrôles de cohérence que l'import. Après l'enregistrement, les différentiels, les index et les classements nets de tous les rounds concernés MUST être recalculés.

#### Scenario: Score corrigé après coup
- **WHEN** l'utilisateur corrige le score de Manu au trou 1 de 7 à 6 sur un round déjà enregistré
- **THEN** le brut de Manu passe à 87 et son index affiché tient compte du nouveau différentiel

### Requirement: Suppression d'un round
Le système SHALL permettre de supprimer un round après une confirmation. La suppression MUST retirer le round de l'historique et du calcul des index, puis recalculer les index des joueurs du round. Pour un round importé depuis une photo, la suppression MUST aussi retirer son import de la liste des imports et effacer la photo du serveur.

#### Scenario: Suppression confirmée
- **WHEN** l'utilisateur supprime un round et confirme
- **THEN** le round disparaît de la liste et l'index de chaque joueur concerné est recalculé sans lui

#### Scenario: Suppression annulée
- **WHEN** l'utilisateur demande la suppression puis annule
- **THEN** le round reste inchangé

#### Scenario: Round importé supprimé
- **WHEN** l'utilisateur supprime un round importé depuis la photo `IMG_3064` et confirme
- **THEN** l'import de cette photo n'apparaît plus dans la liste des imports (il ne revient pas « Prêt à vérifier »), et la photo n'est plus servie

#### Scenario: Round saisi à la main supprimé
- **WHEN** l'utilisateur supprime un round créé sans photo et confirme
- **THEN** le round disparaît de la liste et la liste des imports ne change pas

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
