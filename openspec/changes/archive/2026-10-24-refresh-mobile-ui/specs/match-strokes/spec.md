# Spec Delta

## ADDED Requirements

### Requirement: Grille des coups par trou
Pour chaque joueur, la page Coups SHALL afficher ses coups reçus dans une grille de 18 cases, trous 1 à 9 puis 10 à 18, chaque case portant le numéro du trou et son nombre de coups. Une case sans coup MUST rester vide ; une case à 2 coups ou plus MUST afficher ce nombre. Sur un écran de 320 px, les deux rangées de 9 cases MUST tenir sans défilement horizontal.

#### Scenario: 16 coups sur Bethpage Black / Red
- **WHEN** Manu reçoit 16 coups sur BETHPAGE BLACK / Red
- **THEN** sa grille marque 1 coup sur chaque trou sauf les trous 3 et 14, dont les cases sont vides

#### Scenario: Plus de 18 coups
- **WHEN** un joueur reçoit 20 coups sur BETHPAGE BLACK / Red
- **THEN** les cases des trous 15 et 4 affichent « 2 » et les 16 autres « 1 »

#### Scenario: Grille à 320 px
- **WHEN** la page Coups montre la grille de Manu sur un écran de 320 px
- **THEN** les trous 1 à 9 et 10 à 18 sont visibles sur deux rangées, sans défilement horizontal

### Requirement: Joueur sans coup
Un joueur qui ne reçoit aucun coup SHALL voir « {nom} ne reçoit aucun coup », sans grille.

#### Scenario: Le meilleur joueur en mode « Écart »
- **WHEN** Gab (index 0,6), Manu et Sean sont choisis en mode « Écart »
- **THEN** le résultat de Gab affiche « Gab ne reçoit aucun coup » et aucune grille
