# home-dashboard Specification

## Purpose
Faire de la page d'accueil un point de départ utile au téléphone : lancer un import en un geste et voir d'un coup d'œil où en sont les index, le dernier round et les imports à vérifier.

## Requirements

### Requirement: Action d'import en tête
La page d'accueil SHALL commencer, sous le titre « Handicaps golf », par une action principale « Importer une carte » qui mène à l'écran d'import. Elle MUST NOT reprendre la liste des cinq sections de la navigation.

#### Scenario: Importer depuis l'accueil
- **WHEN** l'utilisateur touche « Importer une carte » sur l'accueil
- **THEN** l'écran d'import `/import` s'ouvre

#### Scenario: Plus de liste de sections
- **WHEN** l'utilisateur ouvre l'accueil sur un écran de 390 px
- **THEN** le contenu de la page ne contient pas de liste « Sections » et le texte « Index simulateur et son évolution. » n'apparaît pas

### Requirement: Index des joueurs
La page d'accueil SHALL afficher chaque joueur avec son index actuel et l'écart avec son index d'avant son dernier round, signé (« −0,3 », « +0,1 », « = » à écart nul). Un index provisoire MUST porter la mention « provisoire ». Un joueur sans round MUST afficher « pas encore d'index » sans écart. Chaque joueur mène à la page Handicaps.

#### Scenario: Index en hausse
- **WHEN** Manu avait un index de 15,5 avant son dernier round et de 15,8 après
- **THEN** l'accueil affiche « Manu », « 15,8 » et « +0,3 »

#### Scenario: Index inchangé
- **WHEN** l'index de Gab est 0,5 avant et après son dernier round
- **THEN** l'accueil affiche « 0,5 » et « = »

#### Scenario: Joueur sans round
- **WHEN** Sean n'a encore aucun round
- **THEN** l'accueil affiche « Sean » et « pas encore d'index », sans écart

#### Scenario: Index provisoire
- **WHEN** Sean a joué 2 rounds
- **THEN** son index s'affiche avec la mention « provisoire »

### Requirement: Dernier round
La page d'accueil SHALL afficher le round le plus récent par date de jeu : parcours, tees, date, score brut de chaque joueur et gagnant net, avec un lien vers la page du round. Sans round, elle MUST afficher « Aucun round enregistré » à la place.

#### Scenario: Dernier round affiché
- **WHEN** le round le plus récent est BETHPAGE BLACK / Red du 17 octobre 2026, Gab 72 et Manu 88, gagnant net Gab
- **THEN** l'accueil affiche « BETHPAGE BLACK · Red », « 17 octobre 2026 », « Gab 72 », « Manu 88 » et « Gagnant net : Gab », et le bloc mène à la page de ce round

#### Scenario: Base vide
- **WHEN** aucun round n'est enregistré
- **THEN** l'accueil affiche « Aucun round enregistré »

### Requirement: Imports à vérifier
Quand des imports lus attendent une vérification (prêts, sans round enregistré), la page d'accueil SHALL l'indiquer avec leur nombre et un lien vers la vérification du plus récent. Sans import à vérifier, ce bloc MUST NOT s'afficher.

#### Scenario: Un import prêt
- **WHEN** un import est prêt et n'a pas encore de round
- **THEN** l'accueil affiche « 1 import à vérifier » avec un lien vers la page de vérification de cet import

#### Scenario: Rien à vérifier
- **WHEN** tous les imports prêts ont leur round enregistré
- **THEN** l'accueil n'affiche aucun bloc « à vérifier »
