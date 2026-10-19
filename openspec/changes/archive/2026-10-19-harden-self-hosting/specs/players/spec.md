# Spec Delta

## MODIFIED Requirements

### Requirement: Joueurs initiaux
Au premier démarrage sur une base sans aucun joueur, le système SHALL créer les joueurs nommés dans la variable `INITIAL_PLAYERS` (noms séparés par des virgules, espaces autour retirés, noms vides ignorés), chacun avec pour alias son nom en majuscules. Variable absente ou vide, le système MUST NOT créer de joueur. Deux noms identiques sans tenir compte de la casse MUST faire échouer le démarrage avec un message qui nomme la variable.

#### Scenario: Base vide
- **WHEN** l'app démarre pour la première fois sur une base vide avec `INITIAL_PLAYERS=Manu, Gab,Sean`
- **THEN** la liste des joueurs contient exactement Gab, Manu et Sean, avec les alias « GAB », « MANU » et « SEAN »

#### Scenario: Base vide sans variable
- **WHEN** l'app démarre pour la première fois sur une base vide sans `INITIAL_PLAYERS`
- **THEN** la liste des joueurs est vide et l'utilisateur peut ajouter des joueurs sur la page Joueurs

#### Scenario: Noms en double
- **WHEN** l'app démarre avec `INITIAL_PLAYERS=Gab,gab`
- **THEN** le démarrage échoue avec un message qui nomme `INITIAL_PLAYERS` et aucun joueur n'est créé

#### Scenario: Base existante
- **WHEN** l'app redémarre sur une base qui contient déjà des joueurs, avec `INITIAL_PLAYERS=Alex,Sam`
- **THEN** le système ne crée et ne modifie aucun joueur

#### Scenario: Base locale recréée
- **WHEN** un développeur lance `pnpm db:reset`
- **THEN** la base locale contient les joueurs Gab, Manu et Sean, quelle que soit la valeur de `INITIAL_PLAYERS`
