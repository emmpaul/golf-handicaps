# Spec Delta

## Purpose

Avant une partie, dire à chaque joueur combien de coups il reçoit et sur quels trous, à partir des index actuels et des index de trou d'un parcours déjà connu.

## ADDED Requirements

### Requirement: Préparation d'une partie
Le système SHALL permettre de choisir 2 à 4 joueurs qui ont un index, provisoire ou non, et un parcours connu (nom et tees). Un joueur sans index MUST être affiché sans pouvoir être choisi, avec la mention « pas encore d'index ».

#### Scenario: Sélection valide
- **WHEN** l'utilisateur choisit Gab, Manu et « Bethpage Black / Red »
- **THEN** le système affiche les coups reçus par chaque joueur

#### Scenario: Joueur sans index
- **WHEN** Sean n'a encore aucun round
- **THEN** Sean apparaît grisé avec « pas encore d'index » et ne peut pas être sélectionné

### Requirement: Modes de calcul des coups
Le système SHALL proposer deux modes. En mode « Écart », le mode par défaut, le joueur au plus petit handicap de jeu reçoit 0 coup et chaque autre joueur reçoit la différence entre son handicap de jeu et ce minimum. En mode « Complet », chaque joueur reçoit son handicap de jeu entier. Le handicap de jeu est l'index actuel arrondi à l'entier (0,5 vers le haut).

#### Scenario: Mode Écart
- **WHEN** Gab a un index de 1,0 et Manu de 17,4, en mode « Écart »
- **THEN** Gab reçoit 0 coup et Manu en reçoit 16

#### Scenario: Mode Complet
- **WHEN** Gab a un index de 1,0 et Manu de 17,4, en mode « Complet »
- **THEN** Gab reçoit 1 coup et Manu en reçoit 17

### Requirement: Répartition des coups par trou
Pour S coups reçus, le système SHALL donner à chaque trou ⌊S / 18⌋ coups, plus 1 coup sur chaque trou dont l'index est inférieur ou égal à S modulo 18. Il SHALL afficher, par joueur, le total de coups et le nombre de coups sur chaque trou.

#### Scenario: 16 coups sur Bethpage Black / Red
- **WHEN** Manu reçoit 16 coups sur Bethpage Black / Red (index : 8,16,18,2,4,10,6,14,12,9,11,7,3,17,1,5,13,15)
- **THEN** Manu reçoit 1 coup sur tous les trous sauf les trous 3 et 14

#### Scenario: Un seul coup
- **WHEN** Gab reçoit 1 coup sur Bethpage Black / Red
- **THEN** son coup tombe sur le trou 15 (index 1)

#### Scenario: Plus de 18 coups
- **WHEN** un joueur reçoit 20 coups sur Bethpage Black / Red
- **THEN** il reçoit 1 coup sur chaque trou et 2 coups sur les trous 15 et 4 (index 1 et 2)

### Requirement: Handicap de jeu négatif
En mode « Complet », un joueur au handicap de jeu négatif −S SHALL rendre 1 coup sur chacun des S trous aux index les plus élevés (18, puis 17, etc.). L'affichage le montre en coups rendus.

#### Scenario: Joueur plus 2
- **WHEN** un joueur a un handicap de jeu de −2 sur Bethpage Black / Red, en mode « Complet »
- **THEN** il rend 1 coup sur le trou 3 (index 18) et 1 sur le trou 14 (index 17)
