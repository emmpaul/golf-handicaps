# Spec Delta

## ADDED Requirements

### Requirement: Lignes de joueur groupées sur téléphone
Dans l'écran de correction et l'éditeur de round, chaque ligne de joueur SHALL former un bloc : numéro de ligne et nom lu sur une rangée, liste du joueur et bouton de retrait côte à côte sur la suivante. Le bouton de retrait MUST NOT se retrouver seul sur une rangée, quelle que soit la largeur à partir de 320 px.

#### Scenario: Ligne à 390 px
- **WHEN** l'écran de correction du round de référence est ouvert sur un écran de 390 px
- **THEN** la liste « Joueur de la ligne 1 » et son bouton de retrait sont sur la même rangée, sous « Ligne 1 » et « lu « GAB » »

#### Scenario: Ligne à 320 px
- **WHEN** le même écran est ouvert sur un écran de 320 px
- **THEN** la liste et le bouton de retrait de chaque ligne sont sur la même rangée

### Requirement: Une action principale à l'import
Sur un appareil à écran tactile, l'écran d'import SHALL présenter « Prendre une photo » comme action principale et le choix d'un fichier comme action secondaire, sous lui, sans titre de champ entre les deux. Le nom accessible « Photo de la carte » du choix de fichier MUST rester.

#### Scenario: Écran d'import sur iPhone
- **WHEN** l'utilisateur ouvre l'écran d'import sur iPhone
- **THEN** « Prendre une photo » est le bouton plein en tête, « Choisir une photo » est un bouton secondaire juste en dessous, et aucun libellé « Photo de la carte » n'est affiché entre eux

#### Scenario: Champ toujours trouvable
- **WHEN** un test cherche le champ de fichier par son nom « Photo de la carte »
- **THEN** il le trouve
