# Spec Delta

## Purpose

Tenir la liste des joueurs du groupe et les alias qui permettent de relier un nom lu sur une carte de score au bon joueur.

## ADDED Requirements

### Requirement: Joueurs initiaux
Au premier démarrage sur une base vide, le système SHALL créer les joueurs Manu, Gab et Sean, chacun avec pour alias son nom en majuscules (« MANU », « GAB », « SEAN »).

#### Scenario: Base vide
- **WHEN** l'app démarre pour la première fois sur une base vide
- **THEN** la liste des joueurs contient exactement Gab, Manu et Sean

#### Scenario: Base existante
- **WHEN** l'app redémarre sur une base qui contient déjà des joueurs
- **THEN** le système ne crée et ne modifie aucun joueur

### Requirement: Ajout et renommage de joueurs
Le système SHALL permettre d'ajouter un joueur et de le renommer. Deux joueurs MUST NOT avoir le même nom, sans tenir compte de la casse.

#### Scenario: Ajout d'un joueur
- **WHEN** l'utilisateur ajoute le joueur « Alex »
- **THEN** « Alex » apparaît dans la liste des joueurs, sans aucun round et sans index

#### Scenario: Nom en double
- **WHEN** l'utilisateur ajoute un joueur nommé « gab » alors que « Gab » existe déjà
- **THEN** le système refuse l'ajout et affiche « Ce joueur existe déjà »

### Requirement: Reconnaissance des noms lus sur la carte
Le système SHALL associer un nom lu sur une carte au joueur dont le nom ou un alias lui est identique, sans tenir compte de la casse ni des espaces autour. Si aucun ne correspond, le système SHALL proposer le joueur le plus proche à au plus 1 caractère de différence, sinon laisser le choix à l'utilisateur.

#### Scenario: Correspondance exacte
- **WHEN** la carte contient le nom « GAB »
- **THEN** la ligne est associée au joueur Gab

#### Scenario: Erreur d'OCR d'un caractère
- **WHEN** l'OCR lit « MANV »
- **THEN** la ligne est pré-associée au joueur Manu et l'utilisateur peut changer ce choix

#### Scenario: Nom inconnu
- **WHEN** la carte contient « JULIEN » et aucun joueur ni alias ne s'en approche
- **THEN** la ligne n'est associée à personne et l'utilisateur doit choisir un joueur existant ou en créer un avant d'enregistrer

### Requirement: Apprentissage des alias
Quand l'utilisateur associe à la main une ligne de carte à un joueur, le système SHALL enregistrer le nom lu comme alias de ce joueur, pour les imports suivants.

#### Scenario: Alias mémorisé
- **WHEN** l'utilisateur associe la ligne « SEANP » au joueur Sean et enregistre le round
- **THEN** à l'import suivant, une ligne « SEANP » est associée directement à Sean
