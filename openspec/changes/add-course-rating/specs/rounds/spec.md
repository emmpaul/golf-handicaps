# Spec Delta

## MODIFIED Requirements

### Requirement: Classement net d'un round
Pour chaque joueur d'un round, le système SHALL afficher le brut, le handicap de jeu, le net et le rang net. Le handicap de jeu est le handicap de parcours : index du joueur juste avant ce round × slope / 113 + (course rating − par total du round), arrondi à l'entier le plus proche (0,5 arrondi vers le haut), avec la course rating et le slope confirmés du parcours et des tees du round. Sans rating confirmée, la course rating vaut le par et le slope 113, et le handicap de jeu est l'index arrondi. Le net vaut brut moins handicap de jeu. Des nets égaux partagent le même rang.

#### Scenario: Classement net à deux
- **WHEN** Gab a un index de 1,0 et Manu de 17,4 avant un round sans rating confirmée où Gab joue 72 et Manu 88
- **THEN** Gab a un handicap de jeu de 1 et un net de 71, Manu de 17 et un net de 71, et les deux sont premiers ex æquo

#### Scenario: Classement net avec rating
- **WHEN** Gab a un index de 1,0 et Manu de 17,4 avant un round sur « BETHPAGE BLACK / Red » (rating 71,4, slope 144, par 71) où Gab joue 72 et Manu 88
- **THEN** Gab a un handicap de jeu de 2 et un net de 70, Manu de 23 et un net de 65, Manu est premier et Gab deuxième

#### Scenario: Joueur sans index
- **WHEN** un joueur joue son tout premier round
- **THEN** son net s'affiche « — » avec la mention « pas encore d'index », et il n'est pas classé en net

## ADDED Requirements

### Requirement: Rating affichée sur le round
La page d'un round SHALL afficher la course rating et le slope utilisés pour ses différentiels et son classement net, ou « sans rating (par, slope 113) » sans rating confirmée, avec un lien vers la page Parcours. La liste des rounds SHALL donner un lien vers la page Parcours.

#### Scenario: Round avec rating
- **WHEN** l'utilisateur ouvre un round sur « BETHPAGE BLACK / Red » confirmé à 71,4 / 144
- **THEN** la page affiche « Rating 71,4 · slope 144 »

#### Scenario: Round sans rating
- **WHEN** l'utilisateur ouvre un round de par 72 sur un parcours sans rating confirmée
- **THEN** la page affiche « Sans rating (par 72, slope 113) » et un lien vers la page Parcours
