# Spec Delta

## ADDED Requirements

### Requirement: Un joueur à la fois sur téléphone
Sur un écran de moins de 768 px, la page Handicaps SHALL afficher un sélecteur des joueurs et la section d'un seul joueur à la fois : le premier joueur de la liste à l'ouverture, puis celui choisi. À partir de 768 px, toutes les sections restent affichées et le sélecteur n'apparaît pas. Le joueur choisi MUST se retrouver dans l'adresse de la page, pour qu'un retour arrière ou un rechargement le garde.

#### Scenario: Ouverture sur téléphone
- **WHEN** l'utilisateur ouvre Handicaps sur un écran de 390 px avec Gab, Manu et Sean
- **THEN** le sélecteur montre « Gab », « Manu » et « Sean », Gab est choisi et seule la section de Gab est affichée

#### Scenario: Choix d'un joueur
- **WHEN** l'utilisateur touche « Manu » dans le sélecteur, puis recharge la page
- **THEN** seule la section de Manu est affichée, avant et après le rechargement

#### Scenario: Ordinateur
- **WHEN** l'utilisateur ouvre Handicaps sur un écran de 1024 px
- **THEN** les sections de Gab, Manu et Sean sont toutes affichées et aucun sélecteur n'apparaît

### Requirement: Résumé de l'index d'un joueur
En tête de la section de chaque joueur, la page Handicaps SHALL afficher son index actuel en grand, et l'écart signé avec son index d'avant son dernier round (« −0,3 », « +0,1 », « = »), avec la mention « provisoire » pour un index provisoire.

#### Scenario: Résumé de Manu
- **WHEN** Manu avait un index de 15,5 avant son dernier round et de 15,8 après
- **THEN** la section de Manu commence par « 15,8 » et « +0,3 »

### Requirement: Marque « Compte » sur la ligne du round
Dans la liste des différentiels, la marque « Compte » SHALL rester sur la même ligne que la date du round, dès 320 px de large.

#### Scenario: Ligne d'un différentiel retenu à 320 px
- **WHEN** la liste des différentiels de Gab s'affiche sur un écran de 320 px
- **THEN** la date « 17 oct. 2026 » et sa marque « Compte » sont à la même hauteur, sur une seule ligne
