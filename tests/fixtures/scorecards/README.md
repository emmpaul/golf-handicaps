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
