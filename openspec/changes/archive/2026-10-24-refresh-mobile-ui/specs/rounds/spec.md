# Spec Delta

## ADDED Requirements

### Requirement: Carte de score d'un round
La page d'un round SHALL afficher, sous le classement net, la carte de score du round : une colonne par trou (1 à 18) avec les totaux OUT, IN et TOT, et une ligne pour le par, l'index de trou et chaque joueur du round dans l'ordre de la carte. Les scores des joueurs portent les marques de score (spec `visual-theme`).

#### Scenario: Carte du round de référence
- **WHEN** l'utilisateur ouvre le round BETHPAGE BLACK / Red du 17 octobre 2026
- **THEN** la carte montre pour Gab « 5 » au trou 1, « 38 » en OUT, « 34 » en IN et « 72 » en TOT, et pour Manu « 88 » en TOT

#### Scenario: Marques sur la carte
- **WHEN** la carte du round de référence s'affiche
- **THEN** le score « 4 » de Gab au trou 7 (par 5) porte la marque birdie et son « 5 » au trou 1 (par 4) la marque bogey

#### Scenario: Carte sur téléphone
- **WHEN** l'utilisateur ouvre la page du round sur un écran de 390 px
- **THEN** la carte défile dans son cadre, la page ne défile pas horizontalement et les libellés « Par », « Gab » et « Manu » restent visibles pendant le défilement
