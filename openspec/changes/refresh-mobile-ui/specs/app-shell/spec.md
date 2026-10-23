# Spec Delta

## ADDED Requirements

### Requirement: Contenu défilant signalé
Un contenu plus large que l'écran qui défile dans son propre cadre (grille de correction, carte de score d'un round, grille des coups) SHALL montrer qu'il reste du contenu à voir de chaque côté où il en reste, par un fondu au bord du cadre. La colonne des libellés de ligne (Trou, Par, Index, noms des joueurs) MUST rester visible pendant le défilement horizontal.

#### Scenario: Grille de correction à 390 px
- **WHEN** l'écran de correction est ouvert sur un écran de 390 px, grille au début
- **THEN** un fondu apparaît au bord droit de la grille et aucun au bord gauche

#### Scenario: Libellés pendant le défilement
- **WHEN** l'utilisateur fait défiler la grille de correction jusqu'au trou 18
- **THEN** les libellés « Par », « Index » et les noms des joueurs restent visibles à gauche, et le fondu est passé au bord gauche

#### Scenario: Grille entière visible
- **WHEN** la grille de correction s'affiche sur un écran de 1440 px où les 18 trous tiennent
- **THEN** aucun fondu n'apparaît

### Requirement: Section courante visible sur la barre d'onglets
Sur la barre d'onglets du bas, la section courante SHALL se distinguer des autres par sa couleur principale et par une forme (pastille derrière l'icône), pas seulement par la graisse du texte.

#### Scenario: Onglet Rounds courant
- **WHEN** l'utilisateur ouvre la page d'un round sur téléphone
- **THEN** l'onglet « Rounds » a une pastille derrière son icône et la couleur principale, les quatre autres n'en ont pas
