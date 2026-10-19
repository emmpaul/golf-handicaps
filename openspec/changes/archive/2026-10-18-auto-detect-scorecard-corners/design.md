# Design

## Context

Motivation : voir `proposal.md`. Comportements : voir `specs/`.

État actuel :
- `ImportFlow` décode la photo dans le navigateur (JPEG ≤ 3000 px), affiche `CropSteps` (poignées `CornerEditor`, aperçu `rectifyPreview`), puis envoie `photo` + `corners` à `POST /api/imports`. `createImport` écrit la photo et l'import (`corners` NOT NULL) avec son job `ocr-scorecard`.
- Le job lit la photo, appelle `readScorecard(photo, corners)` qui redresse le panneau (`rectifyPanel`, 2400×1224 gris) puis le lit, et passe par la complétion IA en repli (`complete`, `AiBudget`, `ClaudeDraftCompleter`).
- Un job qui lève est relancé une fois, puis `onFailed` passe l'import en « Échec ». `recropImport` n'accepte qu'un import en « Échec ».
- Le gabarit `src/ocr/layouts/gspro.ts` donne en pixels du panneau redressé la position de chaque zone (bandeau, lignes, colonnes, ROUND SETTINGS). `detectPlayerRows` dit quelles lignes de joueur ont un nom.
- Une seule photo de référence, `IMG_3064` (3000×2250), avec ses coins mesurés à la main.

Contraintes : TDD, jscpd à 0 %, aucune nouvelle dépendance si on peut l'éviter (image Docker légère, `sharp` déjà là), aucun test qui appelle l'API réelle.

## Goals / Non-Goals

**Goals :**
- Zéro geste de cadrage pour une photo correcte de l'écran GSPro.
- Aucun coût IA quand la détection locale réussit.
- Ne jamais lire une carte avec un cadrage manifestement faux : mieux vaut « Panneau introuvable » qu'un brouillon absurde.

**Non-Goals :**
- Détecter d'autres mises en page que GSPro.
- Détecter le panneau dans le navigateur (aperçu en direct dans le viseur).
- Corriger le flou, les reflets ou le moiré : la lecture reste celle d'aujourd'hui.
- Garder l'ancien envoi avec poignées comme option à l'envoi.

## Decisions

### 1. Détection dans le worker, pas dans le navigateur
La détection tourne au début du job `ocr-scorecard`, quand `imports.corners` est `null`. Le navigateur envoie la photo sans rien d'autre et rend la main tout de suite.
*Alternatives* : détection dans le navigateur pour pré-placer les poignées, écartée. Il faudrait garder l'étape de cadrage à chaque envoi, et dupliquer la logique côté client. Détection synchrone dans `POST /api/imports`, écartée aussi : l'envoi attendrait la détection, et le repli IA (jusqu'à 60 s) ne tient pas dans une requête.

### 2. Détection locale : trouver le tableau clair, en déduire le panneau
Le panneau a un repère stable et facile à isoler : le grand tableau clair (lignes PAR à joueurs), bordé en haut par la ligne sombre des numéros de trou et en bas par la bande sombre « ROUND SETTINGS ». Le fond autour est sombre ou flou.

Étapes, dans `src/ocr/detect-panel.ts`, sur une copie de travail (sharp : `rotate()`, gris, 1000 px sur le grand côté, flou léger) :
1. Seuil d'Otsu, puis composantes connexes des pixels clairs. Les candidates sont les composantes qui couvrent au moins 10 % de l'image, de la plus grande à la plus petite.
2. Pour une candidate, relever son bord : pixel le plus à gauche et le plus à droite de chaque ligne, le plus haut et le plus bas de chaque colonne. Ajuster une droite par côté, par moindres carrés. On écarte les 10 % de points les plus éloignés, puis on refait l'ajustement (coins arrondis, marques de score, reflets). Les 4 intersections donnent le quadrilatère du tableau.
3. Passer du tableau au panneau par le gabarit : une nouvelle constante `TABLE_RECT` (rectangle du tableau clair dans le panneau redressé, mesuré sur `IMG_3064` avec `pnpm ocr:debug`) donne l'homographie tableau → photo. On l'applique aux 4 coins du panneau (0,0), (W,0), (W,H), (0,H), puis on ramène les points en coordonnées normalisées de la photo d'origine.
4. Vérifier (§3). La première candidate acceptée gagne. Si aucune ne l'est, on recommence une fois avec le seuil d'Otsu décalé de −20 (écran plus sombre que prévu).

On réutilise `computeHomography`, `applyHomography` et `panelToPhoto`. On n'ajoute pas de dépendance.
*Alternatives* : OpenCV en WebAssembly (`findContours`, `approxPolyDP`), écarté. Le paquet pèse environ 8 Mo, il ajoute un chargement asynchrone au worker, et la forme est assez simple pour quelques fonctions maison. Une transformée de Hough générale est écartée aussi : plus lente, et plus sensible aux lignes du tableau lui-même. Chercher directement le bandeau sombre du haut est moins fiable : son bord haut se confond souvent avec le fond, sombre lui aussi.

### 3. Vérification commune aux coins locaux et IA
`acceptCorners(photo, corners)` redresse le panneau en taille réelle (`rectifyPanel`) et refuse le cadrage si :
- le quadrilatère n'est pas convexe, ou s'il couvre moins d'un cinquième de la photo ;
- la zone du bandeau (`COURSE_NAME_ZONE` élargie à toute la largeur) n'est pas sombre : médiane au-dessus de 90 ;
- la zone du tableau (`TABLE_RECT`) n'est pas claire : médiane en dessous de 150 ;
- `detectPlayerRows` ne trouve aucune ligne de joueur.

Les seuils seront calibrés sur la référence et les photos ajoutées (questions ouvertes), puis figés en constantes nommées. Le panneau redressé accepté est rendu avec les coins. La lecture le réutilise : `readScorecardPanel(panel)` au lieu de `readScorecard(photo, corners)`, donc on ne redresse qu'une fois.

### 4. Repli IA : Claude donne les coins, la détection locale les affine
Nouveau `src/ai/corner-locator.ts`, `CornerLocator.locate(photoJpeg)`, sur le modèle de `ClaudeDraftCompleter` :
- **Image** : photo remise droite (`rotate()`), métadonnées retirées, réduite à 1568 px sur le grand côté (`fit: "inside"`), JPEG q85, en base64.
- **Requête** : `claude-opus-5-5`, `output_config.effort: "low"`, `max_tokens: 2000`, sortie structurée zod `{ found: boolean, topLeft, topRight, bottomRight, bottomLeft }`. Chaque point est en coordonnées 0–1 de l'image envoyée. Le prompt système décrit les deux repères : le coin haut gauche du bandeau sombre au nom du parcours, et le coin bas droit de la bande « ROUND SETTINGS ». Mêmes options de requête que la complétion : `timeout` 60 s, `maxRetries` 1. Mêmes erreurs typées, avec l'usage dans l'erreur.
- **Affinage** : les coins rendus sont des approximations, à quelques pour cent près. On relance la détection locale (§2) limitée au quadrilatère de l'IA agrandi de 10 %. Si elle trouve un cadrage accepté, on le garde. Sinon, on vérifie les coins de l'IA tels quels (§3).
- **Budget** : `AiBudget.canSpend(now, maxCost)` prend le pire coût de l'appel prévu, au lieu de la constante unique. `MAX_LOCATE_COST` se calcule comme `MAX_CALL_COST`, avec ses propres bornes de tokens : environ 3 200 en entrée, à mesurer sur une vraie requête, et 2 000 en sortie, soit 52 800 micro-dollars. L'usage est enregistré dans `ai_usage` comme une complétion.
- Le `CornerLocator` partage le client Anthropic et le budget du `DraftCompleter`. `AiFallback` devient `{ completer, locator, budget }`, et vaut toujours `null` sans clé.

*Alternative* : demander à Claude de lire la carte directement sur la photo entière, sans coins, écartée. On perdrait la lecture locale gratuite, et chaque import coûterait un appel.

### 5. Flux du job et échec sans relance
Dans `createJobHandlers`, `ocr-scorecard` devient :
1. `status = reading`.
2. Si l'import a des coins (recadrage manuel, ou import antérieur à ce change), on les utilise tels quels, sans vérification : la main fait foi.
3. Sinon : détection locale, puis repli IA si besoin. Quand un cadrage est accepté, on enregistre `corners` et `corners_source` (`auto` ou `ai`).
4. Si aucun cadrage n'est accepté, on passe l'import à `failed` et le job se termine **sans lever**. Aucune seconde tentative : le même calcul sur la même photo donnerait le même résultat, et un second appel IA coûterait pour rien.
5. Sinon, lecture du panneau, puis complétion IA en repli, comme aujourd'hui.

« Panneau introuvable sur la photo » se déduit de l'état : `status = failed` et `corners = null`. On n'ajoute pas de colonne de motif. Un échec de lecture après un recadrage manuel a des coins, et garde donc l'« Échec » générique.

### 6. Données
Migration `0003` :
- `imports.corners` devient nullable. SQLite oblige à reconstruire la table, ce que fait la migration générée par drizzle-kit. On vérifie qu'elle garde les lignes.
- Nouvelle colonne `imports.corners_source`, texte nullable, valeurs `auto`, `ai` ou `manual`. Les imports existants restent à `null` : provenance inconnue, traitée comme `manual`.

`recropImport` écrit `corners_source = manual`. Il accepte `failed`, ou `ready` sans `round_id`. Dans les autres cas, il renvoie `not-recroppable`, et l'API répond 409 « Cet import ne peut pas être recadré ».

### 7. Interface
- `ImportFlow` : `pick → preparing → sending → pick`. `CropSteps` n'y apparaît plus. `enqueue(photo)` envoie le seul champ `photo`. `POST /api/imports` ignore un éventuel champ `corners` et ne le lit plus.
- `ImportList` : un import `failed` sans coins affiche « Panneau introuvable sur la photo » sous son badge. Un import `ready` sans round affiche « Vérifier » et « Recadrer la photo ».
- Écran de correction : lien « Recadrer la photo » à côté de la photo. Quand `corners_source = ai`, une note « Cadrage trouvé par l'IA, vérifie la photo », au même endroit que `aiNote`.
- Page `/imports/[id]/recadrer` : ouverte aux imports recadrables (§6). Les poignées partent des coins enregistrés, sinon d'`INITIAL_CORNERS`. `CropSteps`, `CornerEditor` et `rectifyPreview` restent, utilisés par le seul `RecropImport`.

### 8. Outillage
`pnpm ocr:debug <photo> [corners.json]` : sans fichier de coins, le script lance la détection locale. Il écrit en plus une image de la photo réduite avec le quadrilatère du tableau et celui du panneau dessinés, et les valeurs des trois contrôles du §3. Cette sortie sert à calibrer `TABLE_RECT` et les seuils.

## Risks / Trade-offs

- [Une seule photo de référence : la détection peut être réglée trop juste sur `IMG_3064`] → On ajoute au moins 3 photos de cartes réelles, dans des conditions différentes, avant de figer les seuils. Les tests synthétiques couvrent la rotation EXIF et le cas « pas de carte ». Le repli IA puis le recadrage manuel restent derrière.
- [Cadrage accepté mais légèrement décalé : la lecture se dégrade sans échouer] → La vérification exige un bandeau sombre et des lignes de joueur au bon endroit, et la complétion IA rattrape les cases en problème. « Recadrer la photo » est maintenant possible sur un import prêt.
- [Coins de l'IA imprécis] → Affinage local dans la zone de l'IA (§4), puis vérification. Au pire, « Panneau introuvable » et recadrage manuel, comme aujourd'hui.
- [Confidentialité : la photo entière part chez Anthropic en repli] → Seulement avec une clé configurée et après un échec local. L'image est réduite et sans EXIF (pas de position GPS). Le point est documenté dans le README à côté de `ANTHROPIC_API_KEY`.
- [Temps du worker : détection, plus redressement de vérification, sur une photo de 3000 px] → Le travail se fait sur une copie de 1000 px. Le redressement de vérification sert ensuite à la lecture, donc rien n'est fait deux fois. À mesurer dans les tests : moins de 2 s pour la détection locale de la référence.
- [La migration reconstruit `imports`] → Elle est testée sur une base qui contient des imports dans chaque état. Sauvegarde du volume avant le déploiement, comme pour les migrations précédentes.

## Migration Plan

1. Déployer web et worker ensemble : le nouveau web n'envoie plus de coins, et l'ancien worker ne saurait pas lire un import sans coins.
2. La migration `0003` s'applique au démarrage, comme les précédentes. Les imports en file au moment du déploiement ont des coins, et sont lus comme avant.
3. Retour arrière : redéployer la version précédente. Les imports créés entre-temps sans coins et encore en file seraient bloqués. Il faudrait les recadrer à la main, après avoir remis `corners` NOT NULL par une migration inverse. Ce cas est rare, et accepté.

## Open Questions

- Quelles photos supplémentaires ajouter aux fixtures ? Idéalement : une prise de biais marqué, une avec un reflet sur l'écran, une de nuit ou écran sombre, une avec 4 joueurs. Elles changent les seuils, pas l'approche.
- Bornes de tokens exactes de l'appel de cadrage : à mesurer sur une vraie requête, puis à figer comme `AI_MAX_INPUT_TOKENS`.
