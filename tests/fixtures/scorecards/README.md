# Cartes de score de référence

## `gspro-img3064.jpg`

Photo `IMG_3064.DNG` (iPhone ProRAW, 8064x6048) d'une carte GSPro sur simulateur IDRA, convertie en JPEG et réduite à 3000 px sur le grand côté, comme le fait le navigateur avant l'envoi (design, décision 5.1) :

```sh
sips -s format jpeg -s formatOptions 90 -Z 3000 IMG_3064.DNG --out gspro-img3064.jpg
```

Taille : 3000x2250 px, orientation normale.

## `gspro-img3064.corners.json`

Les 4 coins du panneau de la carte, mesurés à la main sur le JPEG de 3000 px, en coordonnées normalisées entre 0 et 1 (`x` = px / 3000, `y` = px / 2250). Les coins du panneau sont arrondis : chaque point est l'intersection des deux bords droits.

| Clé           | Coin                                               | Pixels       |
| ------------- | -------------------------------------------------- | ------------ |
| `topLeft`     | haut gauche du bandeau sombre « BETHPAGE BLACK »   | (45, 500)    |
| `topRight`    | haut droit du bandeau sombre                       | (2993, 533)  |
| `bottomRight` | bas droit de la bande « ROUND SETTINGS »           | (2900, 1985) |
| `bottomLeft`  | bas gauche de la bande « ROUND SETTINGS »          | (119, 1970)  |

Ordre : sens des aiguilles d'une montre, depuis le haut gauche.

## `gspro-img3064.draft.json`

Brouillon attendu pour la photo de référence, recopié à la main depuis la photo (tâche 6.7). La carte affiche OUT 3139 pour les distances aller, alors que les 9 distances en font 3138 : on garde la valeur imprimée. Sert aussi de vérité terrain au script `scripts/ocr-templates.ts`, qui en extrait les modèles de chiffres.

## Photos du groupe 1 (détection automatique des coins)

Trois photos réelles prises dans d'autres conditions que la référence, pour régler et vérifier `detectPanel` (tâches 1.1 et 2.5 du change `auto-detect-scorecard-corners`). Les coins se mesurent comme ceux de la référence : à la main, en coordonnées normalisées, chaque coin à l'intersection des deux bords droits.

### `gspro-paynes-valley.jpg`

Carte de Paynes Valley, 2 joueurs (SEAN, GAB), datée du 10/14/2026. Pièce sans lumière : l'écran est sombre et son cadre noir l'entoure sur la photo. Le panneau est vu un peu de biais, son bord haut descend de gauche à droite. Photo de 1920x1080 px, plus petite que la limite de 3000 px, donc gardée telle quelle. Orientation normale.

`gspro-paynes-valley.corners.json` (`x` = px / 1920, `y` = px / 1080) :

| Clé           | Coin                                             | Pixels      |
| ------------- | ------------------------------------------------ | ----------- |
| `topLeft`     | haut gauche du bandeau sombre « PAYNES VALLEY »  | (205, 203)  |
| `topRight`    | haut droit du bandeau sombre                     | (1621, 259) |
| `bottomRight` | bas droit de la bande « ROUND SETTINGS »         | (1553, 914) |
| `bottomLeft`  | bas gauche de la bande « ROUND SETTINGS »        | (249, 923)  |

### `gspro-calanova.jpg`

Carte du Calanova Golf Club, 3 joueurs (SEAN, GAB, MANU), datée du 9/3/2026. Photo en portrait de 2250x3000 px, prise de biais : le panneau penche, son bord haut monte de gauche à droite. Un encart translucide du simulateur (vitesse de club, distances) recouvre le bord droit du tableau sur ses premières rangées. C'est le cas qui fixe `OUTLIER_SHARE` dans `src/ocr/detect-panel.ts`.

`gspro-calanova.corners.json` (`x` = px / 2250, `y` = px / 3000) :

| Clé           | Coin                                                   | Pixels       |
| ------------- | ------------------------------------------------------ | ------------ |
| `topLeft`     | haut gauche du bandeau sombre « CALANOVA GOLF CLUB »   | (48, 1199)   |
| `topRight`    | haut droit du bandeau sombre                           | (2037, 1128) |
| `bottomRight` | bas droit de la bande « ROUND SETTINGS »               | (2050, 2177) |
| `bottomLeft`  | bas gauche de la bande « ROUND SETTINGS »              | (90, 2182)   |

### `gspro-tualatin.jpg`

Carte du Tualatin Country Club, 3 joueurs (CHIANT, MANU, DEIVOS). Photo en portrait de 2250x3000 px, un peu de biais. Le cadre de la photo coupe le bord gauche du panneau : le coin haut gauche, mesuré à la main, tombe à x ≈ -0,0047, hors de la photo.

Pas de fichier `.corners.json` : les coins sont bornés entre 0 et 1 (`Corners`, `parseCorners`), et ce panneau n'est pas représentable. Le résultat attendu de `detectPanel` est `null`. L'import passe alors par le repli IA, ou finit en échec avec le cadrage manuel.
