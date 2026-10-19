# scorecard-panel-detection Specification

## Purpose
Trouver les 4 coins du panneau d'une carte GSPro sur une photo, sans que l'utilisateur ait à les placer. La détection tourne sur le serveur de l'app, avec Claude en repli quand elle échoue et qu'une clé est configurée.

## Requirements

### Requirement: Détection locale des coins
Avant la lecture d'un import sans coins, le système SHALL chercher sur la photo les 4 coins du panneau : du coin haut gauche du bandeau sombre (avec le nom du parcours) au coin bas droit de la bande « ROUND SETTINGS ». La détection MUST s'exécuter sur le serveur de l'app, sans service tiers, et tenir compte de l'orientation enregistrée dans la photo.

#### Scenario: Carte de référence IMG_3064
- **WHEN** l'utilisateur importe la photo de référence `IMG_3064` sans placer de coins
- **THEN** chaque coin détecté est à moins de 1 % de la largeur et de la hauteur de la photo du coin mesuré à la main, et l'écran de correction est pré-rempli avec le parcours « BETHPAGE BLACK », les tees « Red », la date 2026-10-17 et 2 lignes de joueur

#### Scenario: Photo tournée par son orientation
- **WHEN** l'utilisateur importe la photo de référence enregistrée de côté, avec une orientation EXIF qui la remet droite
- **THEN** les coins détectés désignent le même panneau que sur la photo droite, et la lecture donne le même brouillon

### Requirement: Vérification du cadrage trouvé
Le système SHALL accepter des coins, détectés localement ou rendus par l'IA, seulement si le panneau redressé selon ces coins a la forme d'une carte GSPro : un bandeau sombre en haut, un tableau clair dessous et au moins une ligne de joueur. Des coins qui ne forment pas un quadrilatère convexe, ou dont le panneau occupe moins d'un cinquième de la photo, MUST être refusés.

#### Scenario: Photo sans carte
- **WHEN** l'utilisateur importe la photo d'un mur blanc
- **THEN** aucun cadrage n'est accepté, ni local ni rendu par l'IA

#### Scenario: Coins rendus par l'IA à côté du panneau
- **WHEN** l'IA rend 4 coins qui encadrent le logo du simulateur au-dessus du panneau
- **THEN** ces coins sont refusés et l'import n'est pas lu avec eux

### Requirement: Repli par l'IA pour le cadrage
Quand la détection locale ne donne aucun cadrage accepté et qu'une clé d'API Anthropic est configurée, le système SHALL demander une seule fois à Claude les 4 coins du panneau. Sans clé, le système MUST NOT faire d'appel et passe directement au cas « Panneau introuvable ».

#### Scenario: Détection locale réussie
- **WHEN** la détection locale trouve un cadrage accepté
- **THEN** aucun appel à l'IA n'est fait pour le cadrage

#### Scenario: Détection locale en échec avec clé
- **WHEN** la détection locale ne trouve aucun cadrage accepté et qu'une clé est configurée
- **THEN** le système fait exactement un appel à l'IA pour le cadrage de cet import, et lit la carte avec les coins rendus s'ils sont acceptés

#### Scenario: Détection locale en échec sans clé
- **WHEN** la détection locale ne trouve aucun cadrage accepté et qu'aucune clé n'est configurée
- **THEN** aucun appel n'est fait et l'import passe à « Échec » avec « Panneau introuvable sur la photo »

### Requirement: Données envoyées pour le cadrage
Pour un cadrage par l'IA, le système SHALL envoyer à Anthropic une seule image : la photo remise droite selon son orientation, réduite à 1568 px au plus sur son grand côté. Il MUST NOT envoyer la photo à sa taille d'origine, ses métadonnées, ni aucune autre donnée de l'app.

#### Scenario: Image envoyée
- **WHEN** un cadrage par l'IA est demandé pour la photo de référence de 3000×2250 px
- **THEN** la requête contient une seule image, de 1568×1176 px, sans données EXIF, et aucune autre image

### Requirement: Budget du cadrage par l'IA
Un appel de cadrage SHALL compter dans le même plafond mensuel que la complétion, selon la capacité `scorecard-ai-completion`. Si le plafond ne permet pas l'appel, ou si l'appel échoue (erreur réseau, erreur de l'API, refus, réponse illisible), le système SHALL traiter l'import comme « Panneau introuvable ». Un appel facturé MUST être compté, même sans coins exploitables.

#### Scenario: Plafond atteint
- **WHEN** le cumul du mois atteint le plafond et que la détection locale échoue
- **THEN** aucun appel n'est fait et l'import passe à « Échec » avec « Panneau introuvable sur la photo »

#### Scenario: Réponse illisible facturée
- **WHEN** l'IA répond au cadrage par un JSON qui ne respecte pas le format attendu
- **THEN** le coût de l'appel entre dans le cumul du mois et l'import passe à « Échec » avec « Panneau introuvable sur la photo »

### Requirement: Panneau introuvable
Quand aucun cadrage n'est accepté, le système SHALL passer l'import à « Échec » avec le message « Panneau introuvable sur la photo », sans relancer la lecture. L'import SHALL proposer de recadrer la photo à la main ou d'ouvrir l'écran de correction vide.

#### Scenario: Échec sans nouvelle tentative
- **WHEN** aucun cadrage n'est accepté pour un import
- **THEN** l'import passe à « Échec » après une seule tentative, avec « Panneau introuvable sur la photo », « Recadrer la photo » et « Ouvrir l'écran de correction vide »

#### Scenario: Recadrage après panneau introuvable
- **WHEN** l'utilisateur ouvre le recadrage d'un import en « Panneau introuvable »
- **THEN** les 4 poignées sont pré-placées à 10 % et 90 % de la photo, comme aucun coin n'a été trouvé

### Requirement: Coins détectés conservés
Le système SHALL enregistrer les coins acceptés avec l'import, et la provenance du cadrage (détection locale, IA ou main). L'écran de recadrage MUST pré-placer les poignées sur ces coins.

#### Scenario: Recadrage d'un import lu
- **WHEN** l'utilisateur ouvre le recadrage d'un import « Prêt à vérifier » dont les coins ont été détectés
- **THEN** les 4 poignées sont placées sur les coins détectés

#### Scenario: Cadrage par l'IA visible
- **WHEN** l'utilisateur ouvre l'écran de correction d'un import cadré par l'IA
- **THEN** l'écran affiche « Cadrage trouvé par l'IA, vérifie la photo »
