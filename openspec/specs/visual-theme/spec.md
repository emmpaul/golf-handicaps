# visual-theme Specification

## Purpose
Donner à l'app une identité visuelle propre au golf, lisible au téléphone en plein jour comme le soir : palette claire et sombre, marque d'app, couleurs des marques de score et chiffres alignés.

## Requirements

### Requirement: Palette Fairway
L'app SHALL utiliser une palette commune à toutes les pages : fond papier chaud (`#F7F5EF`), texte vert très sombre (`#15201A`), couleur principale vert fairway (`#1F5E3B`) pour les actions principales, la section courante et les courbes, et accent sable (`#D9C9A3`). La couleur destructive et la couleur réservée à l'IA restent distinctes de la couleur principale.

#### Scenario: Bouton principal
- **WHEN** l'utilisateur ouvre l'écran d'import en mode clair
- **THEN** le bouton « Prendre une photo » a un fond `#1F5E3B` et un texte clair

#### Scenario: Fond de page
- **WHEN** l'utilisateur ouvre n'importe quelle page en mode clair
- **THEN** le fond de la page est `#F7F5EF`, pas du blanc pur

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
L'en-tête SHALL afficher la marque de l'app (le drapeau de green des icônes d'écran d'accueil) suivie de « Golf », à la place de l'emoji ⛳. La marque est décorative pour les lecteurs d'écran ; le lien garde le nom accessible « Golf ».

#### Scenario: En-tête sur téléphone
- **WHEN** l'utilisateur ouvre une page de l'app
- **THEN** l'en-tête montre le drapeau dessiné et le mot « Golf », et le texte de l'en-tête ne contient pas « ⛳ »

### Requirement: Marques de score
Partout où l'app affiche un score par trou d'un round enregistré, un score sous le par SHALL être marqué d'un cercle rouge birdie (`#C8372D`), un score au-dessus du par d'un carré ardoise (`#1E2A36` en clair), et un score au par MUST rester sans marque. Chaque marque MUST avoir un équivalent textuel pour les lecteurs d'écran.

#### Scenario: Birdie
- **WHEN** Gab joue 3 sur un par 4
- **THEN** sa case montre « 3 » dans un cercle rouge, annoncée « 3, birdie »

#### Scenario: Bogey
- **WHEN** Manu joue 5 sur un par 4
- **THEN** sa case montre « 5 » dans un carré, annoncée « 5, bogey »

#### Scenario: Par
- **WHEN** Gab joue 4 sur un par 4
- **THEN** sa case montre « 4 » sans cercle ni carré

### Requirement: Chiffres alignés
Les nombres affichés en colonne (scores, différentiels, index, handicaps de jeu, nets, coups) SHALL utiliser des chiffres à chasse fixe, pour qu'un « 1 » et un « 8 » occupent la même largeur.

#### Scenario: Colonne des index
- **WHEN** la liste des différentiels de Manu s'affiche avec « 15,8 » et « 17,0 » l'un sous l'autre
- **THEN** les virgules des deux valeurs sont alignées verticalement
