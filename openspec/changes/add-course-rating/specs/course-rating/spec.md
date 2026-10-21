# Spec Delta

## Purpose

Donner à chaque parcours connu (nom et tees) une course rating et un slope confirmés, trouvés sur Simulator Golf Tour ou saisis à la main, pour que l'index et le handicap de jeu tiennent compte de la difficulté du parcours.

## ADDED Requirements

### Requirement: Rating et slope d'un parcours
Le système SHALL associer à chaque parcours connu (nom et tees, sans tenir compte de la casse) au plus une course rating, à une décimale entre 40,0 et 90,0, et un slope, entier entre 55 et 155. Seules des valeurs confirmées par un utilisateur MUST entrer dans les calculs. Une même paire s'applique à tous les rounds joués sur ce parcours et ces tees, passés et futurs.

#### Scenario: Valeurs hors bornes
- **WHEN** l'utilisateur saisit un slope de 160 pour « BETHPAGE BLACK / Red »
- **THEN** la saisie est refusée avec « Slope entre 55 et 155 » et rien n'est enregistré

#### Scenario: Même parcours, autre casse
- **WHEN** « BETHPAGE BLACK / Red » a une rating confirmée et qu'un round est enregistré sur « Bethpage Black / red »
- **THEN** ce round utilise la même rating

### Requirement: Recherche sur Simulator Golf Tour
Pour un parcours sans ligne de rating, le système SHALL chercher en arrière-plan un parcours de la liste Simulator Golf Tour de même nom (casse, accents, ponctuation et préfixe « The » ignorés) et de même par. Une correspondance unique MUST être retenue. Plusieurs correspondances, ou seulement des noms qui se contiennent, MUST être proposées au choix de l'utilisateur. Aucune correspondance donne « Introuvable sur SGT ».

#### Scenario: Nom en capitales avec « The »
- **WHEN** un round est enregistré sur « THE SANCTUARY / White », par 72
- **THEN** le parcours SGT « Sanctuary » (par 72) est retenu sans demande à l'utilisateur

#### Scenario: Par différent
- **WHEN** le seul parcours SGT de même nom a un par de 3 et le round un par de 72
- **THEN** ce parcours n'est pas retenu

#### Scenario: SGT injoignable
- **WHEN** la liste SGT ne répond pas après deux tentatives
- **THEN** le parcours affiche « SGT injoignable » et l'action « Relancer la recherche »

### Requirement: Proposition lue sur la carte SGT
Le parcours SGT retenu, le système SHALL lire sur son image de carte la rating et le slope de chaque tee, par l'IA quand elle est configurée et que le budget du mois le permet, et proposer ceux du tee qui porte le nom des tees du round, sans tenir compte de la casse ni d'une distance en fin de tees. L'image envoyée à l'IA MUST être celle de SGT seule, sans donnée du groupe. Une proposition MUST NOT entrer dans les calculs avant sa confirmation.

#### Scenario: Proposition pour Bethpage Black
- **WHEN** la recherche aboutit pour « BETHPAGE BLACK / Red »
- **THEN** le système propose une rating de 71,4 et un slope de 144, et l'index des joueurs ne change pas

#### Scenario: Distance dans les tees
- **WHEN** les tees du round sont « White 6023yd » et la carte SGT a un tee « White »
- **THEN** la proposition est celle du tee « White »

#### Scenario: Tee absent de la carte
- **WHEN** aucun tee de la carte SGT ne porte le nom des tees du round
- **THEN** le système liste les tees lus avec leur rating et leur slope et demande lequel retenir

#### Scenario: Sans IA ou budget atteint
- **WHEN** l'IA n'est pas configurée, ou que le budget IA du mois est atteint
- **THEN** le parcours affiche le lien de la carte SGT, la raison (« Lecture IA désactivée » ou « Budget IA du mois atteint ») et la saisie manuelle

### Requirement: Page Parcours
Le système SHALL afficher une page Parcours qui liste chaque parcours connu avec sa rating et son slope confirmés ou « sans rating », l'état de la recherche, le lien de la carte SGT et celui de la page The Course View quand un parcours SGT est retenu. La page MUST être atteignable depuis la liste des rounds, la page d'un round et la page Coups, sans nouvelle section dans la navigation principale.

#### Scenario: Parcours en attente de confirmation
- **WHEN** l'utilisateur ouvre la page Parcours après la recherche de « BETHPAGE BLACK / Red »
- **THEN** la ligne montre « sans rating », la proposition 71,4 / 144 du tee Red, un lien vers la carte SGT et l'action « Confirmer »

#### Scenario: Navigation
- **WHEN** l'utilisateur ouvre la page Parcours
- **THEN** la navigation garde ses cinq sections et marque « Rounds » comme section courante

### Requirement: Confirmation, choix et saisie manuelle
Sur la page Parcours, le système SHALL permettre de confirmer une proposition, de choisir un parcours SGT parmi les candidats, de choisir un tee parmi ceux lus, de saisir ou corriger la rating et le slope à la main, et de relancer la recherche. Une confirmation, un choix de tee ou une saisie MUST recalculer les différentiels, index et classements nets de tous les joueurs qui ont un round sur ce parcours. Relancer la recherche MUST NOT modifier les valeurs confirmées.

#### Scenario: Confirmation
- **WHEN** l'utilisateur confirme 71,4 / 144 pour « BETHPAGE BLACK / Red »
- **THEN** le parcours affiche « 71,4 / 144 », et le différentiel de Manu sur la carte `IMG_3064` passe de 17,0 à 13,0

#### Scenario: Choix d'un candidat
- **WHEN** plusieurs parcours SGT correspondent et que l'utilisateur en choisit un
- **THEN** la carte SGT de ce parcours est lue et sa proposition s'affiche

#### Scenario: Recherche relancée sur un parcours confirmé
- **WHEN** l'utilisateur relance la recherche d'un parcours confirmé à 71,4 / 144
- **THEN** la rating reste 71,4 / 144 jusqu'à une nouvelle confirmation

### Requirement: Rounds déjà enregistrés
Au démarrage de l'app, le système SHALL lancer la recherche pour chaque parcours connu qui n'a pas encore de ligne de rating, et la lancer pour un nouveau parcours dès l'enregistrement ou la correction du round qui l'introduit. Un parcours dont la recherche est déjà faite ou en cours MUST NOT être recherché de nouveau sans action de l'utilisateur.

#### Scenario: Premier démarrage après la mise à jour
- **WHEN** l'app démarre avec 6 parcours connus et aucune ligne de rating
- **THEN** une recherche est lancée pour chacun des 6, une seule fois

#### Scenario: Nouveau parcours
- **WHEN** l'utilisateur enregistre le premier round sur « CALANOVA GOLF CLUB / Yellow »
- **THEN** la recherche de ce parcours est lancée sans retarder l'enregistrement
