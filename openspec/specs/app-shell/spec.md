# app-shell Specification

## Purpose
Donner à toutes les pages de l'app un cadre commun utilisable au doigt sur téléphone, y compris ajoutée à l'écran d'accueil, et propre sur ordinateur : navigation, installation, zones sûres, largeur et cibles tactiles.

## Requirements

### Requirement: Navigation entre sections sur téléphone
Sur un écran de moins de 768 px de large, le système SHALL afficher les cinq sections (Importer, Rounds, Handicaps, Coups, Joueurs) dans une barre fixe en bas de l'écran. Chaque section MUST être visible sans défilement, avec une icône et son libellé, à partir de 320 px de large. La barre MUST rester au-dessus de la barre d'accueil de l'appareil et ne jamais masquer le contenu de la page.

#### Scenario: Toutes les sections visibles à 320 px
- **WHEN** l'utilisateur ouvre `/import` sur un écran de 320 px de large
- **THEN** les liens « Importer », « Rounds », « Handicaps », « Coups » et « Joueurs » sont tous entièrement visibles dans la barre du bas

#### Scenario: Bas de page atteignable
- **WHEN** l'utilisateur fait défiler une longue page (Handicaps) jusqu'en bas sur téléphone
- **THEN** la dernière ligne de la page s'affiche au-dessus de la barre de navigation, sans être recouverte

#### Scenario: Ordinateur
- **WHEN** l'utilisateur ouvre l'app sur un écran de 1024 px de large
- **THEN** les cinq sections sont dans la navigation du haut et aucune barre n'est fixée en bas

### Requirement: Section courante indiquée
La navigation SHALL marquer la section de la page affichée, sur téléphone comme sur ordinateur, de façon visible et annoncée aux lecteurs d'écran (`aria-current="page"`). Une sous-page (un round, un import) MUST marquer sa section parente.

#### Scenario: Sous-page d'un round
- **WHEN** l'utilisateur ouvre la page d'un round
- **THEN** le lien « Rounds » porte `aria-current="page"` et aucun autre lien ne le porte

#### Scenario: Accueil
- **WHEN** l'utilisateur ouvre la page d'accueil
- **THEN** aucun lien de section ne porte `aria-current`

### Requirement: Installation sur l'écran d'accueil
Le système SHALL fournir un manifest d'application (nom « Handicaps golf », nom court « Golf », affichage plein écran `standalone`, adresse de départ `/`) et une icône d'app propre, de 180 px pour iOS, et de 192 et 512 px pour le manifest. Ouverte depuis l'écran d'accueil, l'app MUST s'afficher sans barre de navigateur.

#### Scenario: Manifest servi
- **WHEN** le navigateur charge le manifest référencé par la page
- **THEN** il obtient `display` égal à `standalone`, `start_url` égal à `/` et des icônes de 192 et 512 px

#### Scenario: Icône iOS
- **WHEN** Safari iOS cherche l'icône d'écran d'accueil de la page
- **THEN** il trouve une image PNG de 180 × 180 px

### Requirement: Zones sûres en plein écran
L'app SHALL occuper tout l'écran, encoche et barre d'accueil comprises. L'en-tête, la barre de navigation du bas et la barre d'enregistrement de l'écran de correction MUST tenir compte des marges de zone sûre de l'appareil, pour qu'aucun texte ni bouton ne passe sous l'encoche, l'îlot ou la barre d'accueil.

#### Scenario: Barre d'enregistrement sur iPhone
- **WHEN** l'écran de correction est ouvert depuis l'écran d'accueil d'un iPhone avec barre d'accueil
- **THEN** le bouton « Enregistrer » s'affiche entièrement au-dessus de la barre d'accueil et de la barre de navigation

#### Scenario: En-tête sous l'encoche
- **WHEN** l'app est ouverte en plein écran sur un iPhone à îlot
- **THEN** « ⛳ Golf » s'affiche sous l'îlot, pas derrière

### Requirement: Pas de défilement horizontal de la page
Sur un écran de 320 px de large ou plus, aucune page ni aucun état ouvert (calendrier, dialogue, photo choisie) MUST NOT élargir la page au-delà de l'écran. Sous 768 px, aucun contenu MUST NOT défiler horizontalement dans son propre cadre : grilles et tableaux se réorganisent pour tenir dans la largeur. À partir de 768 px, un contenu plus large que l'écran SHALL défiler dans son propre cadre. Aucune information MUST NOT être masquée sans possibilité de la voir.

#### Scenario: Calendrier à 320 px
- **WHEN** l'utilisateur ouvre le calendrier de la date de jeu sur un écran de 320 px de large
- **THEN** la largeur de la page reste égale à celle de l'écran et les 7 jours de la semaine sont visibles

#### Scenario: Marque « Compte » sur téléphone
- **WHEN** l'utilisateur ouvre Handicaps sur un écran de 390 px de large
- **THEN** chaque marque « Compte » est entièrement visible sans défilement

#### Scenario: Toutes les pages
- **WHEN** l'utilisateur ouvre l'accueil, Importer, la correction d'un import, Rounds, un round, la modification d'un round, un nouveau round, Joueurs, Handicaps et Coups à 320 puis 390 px
- **THEN** sur chacune, la largeur de la page reste égale à celle de l'écran

#### Scenario: Aucun cadre défilant sur téléphone
- **WHEN** l'utilisateur ouvre les mêmes pages à 320 puis 390 px, avec un round de 4 joueurs
- **THEN** aucun élément du contenu de la page n'est plus large que sa zone visible, et rien ne défile horizontalement

### Requirement: Cibles tactiles et texte des champs sur téléphone
Sur un écran de moins de 768 px, chaque bouton, champ, liste déroulante, case de la grille des scores et lien d'action SHALL offrir une zone de toucher d'au moins 44 px de haut. Le texte des champs et des listes déroulantes MUST faire au moins 16 px, pour qu'iOS ne zoome pas au focus. À partir de 768 px, les contrôles gardent leur taille d'ordinateur.

#### Scenario: Liste déroulante sur iPhone
- **WHEN** l'écran de correction est ouvert sur iPhone
- **THEN** la liste « Joueur de la ligne 1 » mesure au moins 44 px de haut et son texte fait 16 px

#### Scenario: Lien d'action dans la liste des imports
- **WHEN** un import prêt est listé sur iPhone
- **THEN** le lien « Vérifier » offre une zone de toucher d'au moins 44 px de haut

#### Scenario: Case de score sur iPhone
- **WHEN** l'écran de correction est ouvert sur un écran de 390 px
- **THEN** la case du score du trou 1 de la ligne 1 mesure au moins 44 px de haut et son texte fait 16 px

#### Scenario: Ordinateur inchangé
- **WHEN** l'écran Joueurs est ouvert à 1440 px de large
- **THEN** le bouton « Ajouter » mesure 32 px de haut

### Requirement: Contenu défilant signalé
À partir de 768 px, un contenu plus large que sa zone qui défile dans son propre cadre (grille de correction, carte de score d'un round) SHALL montrer qu'il reste du contenu à voir de chaque côté où il en reste, par un fondu au bord du cadre. La colonne des libellés de ligne (Trou, Par, Index, noms des joueurs) MUST rester visible pendant le défilement horizontal.

#### Scenario: Grille de correction à 390 px
- **WHEN** l'écran de correction est ouvert sur un écran de 390 px
- **THEN** la grille ne défile pas horizontalement et aucun fondu n'apparaît à ses bords

#### Scenario: Grille de correction à 800 px
- **WHEN** l'écran de correction est ouvert sur un écran de 800 px, grille au début
- **THEN** un fondu apparaît au bord droit de la grille et aucun au bord gauche

#### Scenario: Libellés pendant le défilement
- **WHEN** l'utilisateur fait défiler la grille de correction jusqu'au trou 18 sur un écran de 800 px
- **THEN** les libellés « Par », « Index » et les noms des joueurs restent visibles à gauche, et le fondu est passé au bord gauche

#### Scenario: Grille entière visible
- **WHEN** la grille de correction s'affiche sur un écran de 1440 px où les 18 trous tiennent
- **THEN** aucun fondu n'apparaît

### Requirement: Section courante visible sur la barre d'onglets
Sur la barre d'onglets du bas, la section courante SHALL se distinguer des autres par sa couleur principale et par une forme (pastille derrière l'icône), pas seulement par la graisse du texte.

#### Scenario: Onglet Rounds courant
- **WHEN** l'utilisateur ouvre la page d'un round sur téléphone
- **THEN** l'onglet « Rounds » a une pastille derrière son icône et la couleur principale, les quatre autres n'en ont pas

### Requirement: En-tête net sous la barre d'état
Sur iPhone, dans Safari comme en app ajoutée à l'écran d'accueil, la marque et le texte de l'en-tête SHALL rester nets : aucun flou ni bandeau du navigateur ne les recouvre, en haut de page comme après défilement. La zone sous la barre d'état MUST prendre la couleur de l'en-tête, en mode clair comme en mode sombre.

#### Scenario: Safari en haut de page
- **WHEN** l'utilisateur ouvre l'accueil dans Safari sur iPhone
- **THEN** la marque et le mot « Golf » sont nets, et la zone sous la barre d'état a la couleur de l'en-tête

#### Scenario: Après défilement
- **WHEN** l'utilisateur fait défiler la page Rounds dans Safari sur iPhone
- **THEN** l'en-tête reste en haut, net, et aucun texte de la page n'apparaît flou derrière la barre d'état

#### Scenario: Mode sombre
- **WHEN** l'iPhone est en mode sombre et l'accueil est ouvert dans Safari
- **THEN** la zone sous la barre d'état a la couleur sombre de l'en-tête et le mot « Golf » est net

#### Scenario: App ajoutée à l'écran d'accueil
- **WHEN** l'utilisateur ouvre l'app depuis son icône d'écran d'accueil
- **THEN** l'en-tête commence sous la barre d'état, net, sans bande d'une autre couleur au-dessus

#### Scenario: En-tête opaque
- **WHEN** une page de l'app s'affiche à 390 px, en clair puis en sombre
- **THEN** l'en-tête est collé en haut de la fenêtre, son fond calculé est entièrement opaque et sans filtre d'arrière-plan, et il a la même couleur que le fond de `html` et de `body`
