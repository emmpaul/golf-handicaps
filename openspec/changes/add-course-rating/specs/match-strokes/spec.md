# Spec Delta

## MODIFIED Requirements

### Requirement: Modes de calcul des coups
Le système SHALL proposer deux modes. En mode « Écart », le mode par défaut, le joueur au plus petit handicap de jeu reçoit 0 coup et chaque autre joueur reçoit la différence entre son handicap de jeu et ce minimum. En mode « Complet », chaque joueur reçoit son handicap de jeu entier. Le handicap de jeu est le handicap de parcours : index actuel × slope / 113 + (course rating − par total du parcours), arrondi à l'entier (0,5 vers le haut), avec la course rating et le slope confirmés du parcours choisi. Sans rating confirmée, c'est l'index actuel arrondi à l'entier.

#### Scenario: Mode Écart
- **WHEN** Gab a un index de 1,0 et Manu de 17,4, sur un parcours sans rating confirmée, en mode « Écart »
- **THEN** Gab reçoit 0 coup et Manu en reçoit 16

#### Scenario: Mode Complet
- **WHEN** Gab a un index de 1,0 et Manu de 17,4, sur un parcours sans rating confirmée, en mode « Complet »
- **THEN** Gab reçoit 1 coup et Manu en reçoit 17

#### Scenario: Mode Écart avec rating
- **WHEN** Gab a un index de 1,0 et Manu de 17,4 sur « Bethpage Black / Red » (rating 71,4, slope 144, par 71), en mode « Écart »
- **THEN** Gab reçoit 0 coup et Manu en reçoit 21

#### Scenario: Mode Complet avec rating
- **WHEN** Gab a un index de 1,0 et Manu de 17,4 sur « Bethpage Black / Red » (rating 71,4, slope 144, par 71), en mode « Complet »
- **THEN** Gab reçoit 2 coups et Manu en reçoit 23

## ADDED Requirements

### Requirement: Rating du parcours choisi
La page Coups SHALL afficher la course rating et le slope du parcours choisi, ou « sans rating » avec un lien vers la page Parcours quand aucune rating n'est confirmée.

#### Scenario: Parcours sans rating
- **WHEN** l'utilisateur choisit un parcours sans rating confirmée
- **THEN** la page affiche « sans rating » et un lien vers la page Parcours, et les coups se calculent depuis l'index arrondi
