# Spec Delta

## ADDED Requirements

### Requirement: Prise de photo depuis l'app
Sur un appareil à écran tactile, l'écran d'import SHALL proposer « Prendre une photo », qui ouvre directement l'appareil photo arrière sans passer par la photothèque. La photo prise MUST suivre le même parcours qu'une photo choisie dans les fichiers : cadrage, aperçu redressé, mise en file, et même message si le format est illisible. Le choix d'un fichier SHALL rester disponible. Sur un appareil sans écran tactile, « Prendre une photo » MUST NOT s'afficher.

#### Scenario: Photo prise au téléphone
- **WHEN** sur iPhone, l'utilisateur touche « Prendre une photo » et prend la photo de la carte de référence
- **THEN** la photo s'affiche à l'écran de cadrage, comme une photo choisie dans les fichiers

#### Scenario: Prise de vue annulée
- **WHEN** l'utilisateur touche « Prendre une photo » puis annule dans l'appareil photo
- **THEN** l'écran d'import reste tel qu'il était, sans message d'erreur

#### Scenario: Photo déjà prise
- **WHEN** sur iPhone, l'utilisateur veut importer une photo déjà dans sa photothèque
- **THEN** le champ « Photo de la carte » est toujours là et permet de la choisir

#### Scenario: Ordinateur
- **WHEN** l'utilisateur ouvre l'écran d'import sur un ordinateur sans écran tactile
- **THEN** « Prendre une photo » ne s'affiche pas et « Photo de la carte » reste disponible
