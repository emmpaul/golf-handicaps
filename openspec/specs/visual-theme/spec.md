# visual-theme Specification

## Purpose
Donner à l'app une identité visuelle propre au golf, lisible au téléphone en plein jour comme le soir : palette claire et sombre, marque d'app, couleurs des marques de score et chiffres alignés.

## Requirements

### Requirement: Thème sombre selon le système
L'app SHALL afficher un thème sombre quand l'appareil est réglé en mode sombre, et le thème clair sinon, sans réglage dans l'app. En mode sombre, le texte MUST garder un contraste d'au moins 4,5:1 avec son fond, et la couleur de la barre d'état (`theme-color`) MUST suivre le mode.

#### Scenario: Téléphone en mode sombre
- **WHEN** l'utilisateur ouvre Rounds sur un téléphone réglé en mode sombre
- **THEN** la page s'affiche sur fond sombre avec un texte clair, et la barre d'onglets aussi

#### Scenario: Couleur de la barre d'état
- **WHEN** le navigateur lit la page
- **THEN** il trouve une couleur `theme-color` pour `prefers-color-scheme: light` et une autre pour `prefers-color-scheme: dark`

#### Scenario: Contraste du texte secondaire
- **WHEN** la page Handicaps s'affiche en mode sombre
- **THEN** le texte secondaire (« Index simulateur, inspiré du WHS… ») a un contraste d'au moins 4,5:1 avec le fond

### Requirement: Marque d'app dans l'en-tête
L'en-tête SHALL afficher la marque de l'app (le même dessin que les icônes d'écran d'accueil, dans les couleurs de la palette) suivie de « Golf », à la place de l'emoji ⛳. La marque est décorative pour les lecteurs d'écran ; le lien garde le nom accessible « Golf ».

#### Scenario: En-tête sur téléphone
- **WHEN** l'utilisateur ouvre une page de l'app
- **THEN** l'en-tête montre la marque dessinée et le mot « Golf », et le texte de l'en-tête ne contient pas « ⛳ »

#### Scenario: Même marque sur l'écran d'accueil
- **WHEN** le navigateur demande l'icône d'écran d'accueil
- **THEN** l'icône montre le même dessin que l'en-tête, dans les couleurs de la palette

### Requirement: Marques de score
Partout où l'app affiche un score par trou d'un round enregistré, un score sous le par SHALL être marqué d'un cercle dans la couleur « sous le par » de la palette, un score au-dessus du par d'un carré dans la couleur « au-dessus du par », et un score au par MUST rester sans marque. Les deux couleurs MUST se distinguer l'une de l'autre et de la couleur principale, et chaque marque MUST avoir un équivalent textuel pour les lecteurs d'écran.

#### Scenario: Birdie
- **WHEN** Gab joue 3 sur un par 4
- **THEN** sa case montre « 3 » dans un cercle de la couleur « sous le par » (`#CB1E21` en clair, `#F86B65` en sombre), annoncée « 3, birdie »

#### Scenario: Bogey
- **WHEN** Manu joue 5 sur un par 4
- **THEN** sa case montre « 5 » dans un carré de la couleur « au-dessus du par » (`#46566E` en clair, `#A9B9CA` en sombre), annoncée « 5, bogey »

#### Scenario: Par
- **WHEN** Gab joue 4 sur un par 4
- **THEN** sa case montre « 4 » sans cercle ni carré

### Requirement: Chiffres alignés
Les nombres affichés en colonne (scores, différentiels, index, handicaps de jeu, nets, coups) SHALL utiliser des chiffres à chasse fixe, pour qu'un « 1 » et un « 8 » occupent la même largeur.

#### Scenario: Colonne des index
- **WHEN** la liste des différentiels de Manu s'affiche avec « 15,8 » et « 17,0 » l'un sous l'autre
- **THEN** les virgules des deux valeurs sont alignées verticalement

### Requirement: Palette sur mesure
L'app SHALL utiliser une palette propre, commune à toutes les pages, choisie pendant la refonte selon la direction retenue dans `design.md`. Chaque couleur et chaque police MUST venir d'un token déclaré une seule fois pour le mode clair et une fois pour le mode sombre ; aucune page, aucun composant ni aucune icône ne contient de couleur ou de police en dur. La couleur destructive reste distincte de la couleur principale.

#### Scenario: Plus de vert Fairway
- **WHEN** l'utilisateur ouvre l'écran d'import en mode clair après la refonte
- **THEN** le fond de la page est `#F4F7FB` et non `#F7F5EF`, et le bouton principal a un fond `#0F1D3E` et non `#1F5E3B`

#### Scenario: Contraste du texte en mode clair
- **WHEN** la page Rounds s'affiche en mode clair
- **THEN** le texte courant et le texte secondaire ont chacun un contraste d'au moins 4,5:1 avec leur fond

#### Scenario: Aucune couleur hors des tokens
- **WHEN** le linter Hallmark lit `src/app` et `src/components`
- **THEN** il ne signale aucune couleur ni police écrite en dehors du bloc de tokens

### Requirement: Mouvement des contrôles
Les transitions des contrôles SHALL ne porter que sur des propriétés nommées (couleur, opacité, transformation), jamais sur toutes les propriétés ni sur la largeur, la hauteur ou la position. Quand l'appareil demande un mouvement réduit, l'ouverture et la fermeture des boîtes de dialogue MUST se faire sans animation de déplacement ni de zoom.

#### Scenario: Mouvement réduit sur la confirmation de suppression
- **WHEN** l'utilisateur, avec le mouvement réduit activé, touche « Supprimer » sur un round
- **THEN** la boîte de confirmation apparaît sans glisser ni grandir

#### Scenario: Pas de transition globale
- **WHEN** le linter Hallmark lit les composants de base
- **THEN** il ne signale aucune transition sur toutes les propriétés

### Requirement: Focus visible au clavier
Chaque élément interactif (lien, bouton, onglet, champ, case, liste) SHALL montrer un contour de focus dès qu'il reçoit le focus au clavier, sans fondu, avec un contraste d'au moins 3:1 contre ce qui l'entoure.

#### Scenario: Tabulation dans la barre d'onglets
- **WHEN** l'utilisateur passe au clavier sur l'onglet « Handicaps »
- **THEN** l'onglet montre un contour de focus dans la même image, sans transition

### Requirement: Couleurs du manifest
Le manifest de l'app SHALL déclarer comme `theme_color` et `background_color` les couleurs de fond de la palette en mode clair, pas `#ffffff`.

#### Scenario: Manifest servi
- **WHEN** le navigateur demande `/manifest.webmanifest`
- **THEN** `theme_color` et `background_color` valent la couleur de fond claire de la palette
