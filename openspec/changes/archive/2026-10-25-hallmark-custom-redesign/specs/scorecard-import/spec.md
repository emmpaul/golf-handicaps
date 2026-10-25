## ADDED Requirements

### Requirement: Saisie manuelle neuve sans alerte
Dans une saisie entièrement manuelle, une case obligatoire encore vide que l'utilisateur n'a pas quittée SHALL s'afficher comme « à remplir », sans la couleur ni l'état d'erreur. Elle passe en erreur dès que l'utilisateur la quitte vide. Les cases en défaut d'un contrôle de cohérence, et les cases vides d'un import lu par OCR, restent surlignées comme avant. Le bouton d'enregistrement MUST compter tous les problèmes, cases vides non touchées comprises.

#### Scenario: Ouverture d'une saisie manuelle
- **WHEN** l'utilisateur ouvre « Saisie manuelle » sans choisir de parcours
- **THEN** aucune case de la grille n'est marquée en erreur, et le bouton affiche le nombre de problèmes restants

#### Scenario: Case quittée vide
- **WHEN** l'utilisateur entre dans la case du par du trou 1 puis la quitte sans rien saisir
- **THEN** cette case est marquée en erreur et les autres cases vides non touchées ne le sont pas

#### Scenario: Import lu par OCR
- **WHEN** l'OCR n'a pas pu lire le score du trou 9 de la ligne 1
- **THEN** cette case est surlignée dès l'ouverture de l'écran de correction

### Requirement: Grille de correction sur téléphone
Sous 768 px, la grille de correction et de saisie SHALL présenter une ligne par trou : numéro du trou, par, index, puis le score de chaque ligne de joueur, avec OUT après le trou 9, IN et TOT après le trou 18. La distance reste modifiable pour chaque trou. Les noms des lignes de joueur MUST rester visibles en tête de colonne pendant le défilement vertical, et la grille MUST NOT défiler horizontalement à 320 px avec 4 lignes de joueur. Chaque case garde le même nom accessible qu'en grille large.

#### Scenario: Quatre joueurs à 320 px
- **WHEN** l'écran de correction d'une carte à 4 lignes de joueur est ouvert sur un écran de 320 px
- **THEN** le par, l'index et les 4 scores du trou 1 sont visibles sur une même ligne, et la grille ne défile pas horizontalement

#### Scenario: Noms en tête pendant le défilement
- **WHEN** l'utilisateur fait défiler la grille jusqu'au trou 18 sur un écran de 390 px
- **THEN** les noms des lignes de joueur restent visibles en haut de la grille

#### Scenario: Même case, autre disposition
- **WHEN** l'utilisateur saisit « 5 » dans la case nommée « Ligne 1 trou 9 » à 390 px
- **THEN** la même case existe à 1440 px dans la grille large, avec la même valeur et le même contrôle de cohérence

#### Scenario: Grille large sur ordinateur
- **WHEN** l'écran de correction est ouvert à 1440 px
- **THEN** la grille garde une colonne par trou, comme avant
