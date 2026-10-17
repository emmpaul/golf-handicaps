# Spec Delta

## Purpose

Calculer pour chaque joueur un index de handicap inspiré du WHS, adapté au simulateur (ni course rating ni slope), et en garder l'historique après chaque round.

## ADDED Requirements

### Requirement: Score ajusté par trou
Pour le handicap, le système SHALL compter chaque trou au plus par + 4 (quadruple bogey). Le score ajusté du round est la somme des 18 trous ainsi plafonnés. Le score brut affiché ne change pas.

#### Scenario: Trou plafonné
- **WHEN** un joueur fait 10 sur un par 4
- **THEN** ce trou compte 8 dans le score ajusté, et le brut affiché reste 10

#### Scenario: Aucun trou au-dessus du plafond
- **WHEN** Manu joue la carte `IMG_3064` (88 brut, aucun trou au-delà de par + 4)
- **THEN** son score ajusté vaut 88

### Requirement: Différentiel d'un round
Le système SHALL calculer le différentiel d'un joueur sur un round : score ajusté moins par total du round, avec un slope fixé à 113. Le différentiel est un nombre à une décimale.

#### Scenario: Différentiels de la carte de référence
- **WHEN** la carte `IMG_3064` (par 71) est enregistrée
- **THEN** le différentiel de Gab vaut 1,0 et celui de Manu 17,0

### Requirement: Calcul de l'index
L'index d'un joueur SHALL se calculer sur ses 20 derniers rounds au plus, triés par date de jeu puis par ordre d'enregistrement. On applique la table WHS au nombre n de rounds : 3 → meilleur − 2,0 ; 4 → meilleur − 1,0 ; 5 → meilleur ; 6 → moyenne des 2 meilleurs − 1,0 ; 7-8 → 2 meilleurs ; 9-11 → 3 ; 12-14 → 4 ; 15-16 → 5 ; 17-18 → 6 ; 19 → 7 ; 20 → 8.

#### Scenario: Trois rounds
- **WHEN** les différentiels d'un joueur sont 17,0, 12,0 et 20,0
- **THEN** son index vaut 10,0

#### Scenario: Six rounds
- **WHEN** les différentiels d'un joueur sont 17,0, 12,0, 20,0, 15,0, 14,0 et 18,0
- **THEN** son index vaut 12,0

#### Scenario: Plus de 20 rounds
- **WHEN** un joueur a 21 rounds et que le plus ancien porte son meilleur différentiel
- **THEN** ce plus ancien round n'entre pas dans le calcul de l'index

### Requirement: Index provisoire
Avec 1 ou 2 rounds, le système SHALL calculer un index provisoire égal à la moyenne des différentiels, affiché avec la mention « provisoire ». Sans aucun round, le joueur n'a pas d'index.

#### Scenario: Deux rounds
- **WHEN** les différentiels d'un joueur sont 17,0 et 12,0
- **THEN** son index affiché est « 14,5 (provisoire) »

#### Scenario: Aucun round
- **WHEN** un joueur vient d'être créé
- **THEN** son index s'affiche « — »

### Requirement: Arrondi et bornes de l'index
L'index SHALL être arrondi au dixième le plus proche, 0,05 arrondi vers le haut, et plafonné à 54,0. Un index négatif (joueur « plus ») est permis.

#### Scenario: Arrondi
- **WHEN** la moyenne retenue moins l'ajustement donne 13,25
- **THEN** l'index vaut 13,3

#### Scenario: Plafond
- **WHEN** le calcul donne 61,0
- **THEN** l'index vaut 54,0

### Requirement: Historique de l'index
Le système SHALL conserver l'index de chaque joueur après chacun de ses rounds. Il SHALL afficher une courbe de l'index dans le temps, une par joueur, ainsi que la liste des différentiels du joueur, avec une marque sur ceux qui comptent dans son index actuel.

#### Scenario: Courbe après trois rounds
- **WHEN** Gab a joué trois rounds
- **THEN** la courbe de Gab montre trois points, datés à chacun de ces rounds, chacun égal à l'index juste après ce round

#### Scenario: Différentiels retenus
- **WHEN** un joueur a 6 rounds
- **THEN** ses 2 meilleurs différentiels sont marqués comme comptant dans l'index

### Requirement: Recalcul complet
Après tout ajout, correction ou suppression de round, le système SHALL recalculer les différentiels et tout l'historique d'index des joueurs concernés, y compris pour les rounds postérieurs à la date modifiée.

#### Scenario: Round ajouté dans le passé
- **WHEN** l'utilisateur enregistre un round daté d'avant les autres rounds de Gab
- **THEN** les index de Gab après chacun de ses rounds suivants sont recalculés avec ce round
