# Design

## Context

Voir `proposal.md` pour la motivation. État observé :

- **Calcul.** `differentialTenths` (`src/domain/handicap.ts`) vaut `(score ajusté − par total) × 10`. `playingHandicap` (`src/domain/strokes.ts`) arrondit l'index au plus proche entier ; `rankNet` (`src/server/rounds/leaderboard.ts`) et `matchStrokes` (page Coups) l'utilisent tous les deux. `recomputePlayerStats` (`src/server/rounds/stats.ts`) rejoue l'historique d'un joueur et réécrit `player_round_stats` (différentiel, index avant et après). Les handicaps sont stockés en dixièmes entiers (`_t`).
- **Parcours.** Il n'y a pas de table des parcours : `knownCourses` regroupe les rounds par `lower(trim(nom))` et `lower(trim(tees))`. Les cartes GSPro donnent des noms en capitales et parfois la distance dans les tees.
- **Prod (lecture seule, 2026-10-21).** 6 rounds, 3 joueurs, 6 paires parcours/tees : `BETHPAGE BLACK / Red`, `CALANOVA GOLF CLUB / Yellow`, `PAYNES VALLEY / Blue`, `PAYNES VALLEY / Blue 6212yd`, `THE SANCTUARY / White`, `TUALATIN COUNTRY CLUB / White 6023yd`.
- **SGT.** `https://simulatorgolftour.com/courses` (HTTP 200 sans navigateur, 665 Ko) contient `<script id='courses-data' type='application/json'>` : `{"v":1,"updated":…,"cardUrl":"/public/assets/courseImages/scorecards/scorecard_{COURSEID}.jpg?v=1.1","courses":[[id, nom, lieu, par, …], …]}`, 2 740 parcours. Pas de rating dans ce JSON. L'image de carte (905×527, JPEG) porte une ligne « Slope/Rating » avec, par tee, `rating/slope` : Bethpage Black (id 30) → Blue 77.5/155, White 74.2/148, Red 71.4/144, Junior 71.0/120, PAR3 54.0/120. Le script de page (`sgt-static.b-cdn.net/…/page.js`) répond 403 hors navigateur ; il n'est pas nécessaire.
- **The Course View.** `https://thecourseview.com/courses/<slug>` (ex. `bethpage-black`) affiche un tableau texte tee / yards / slope / rating, aux mêmes valeurs que SGT et avec les images de SGT. Hors navigateur, toute requête reçoit HTTP 429 « Vercel Security Checkpoint ».
- **Correspondance des noms prod → SGT**, après normalisation (décision 4) : Bethpage Black → 30, Calanova Golf Club → 3216, Paynes Valley → 573, The Sanctuary → 477 « Sanctuary », Tualatin Country Club → 3466. Une seule correspondance exacte pour chacun ; « sanctuary » en contient 5 en sous-chaîne.
- **IA.** `askAboutImage` (`src/ai/claude-call.ts`) envoie une image JPEG avec une sortie structurée zod ; `AiBudget` vérifie un pire coût avant chaque appel et enregistre l'usage dans `ai_usage`. Sans `ANTHROPIC_API_KEY`, le worker n'a pas d'IA.
- **Démarrage.** Le web applique les migrations, puis lance des tâches de fond (`src/instrumentation.ts`, conversion WebP). Le worker attend `EXPECTED_SCHEMA_VERSION` (`src/jobs/schema-version.ts`).

## Goals / Non-Goals

**Goals:**

- Aucun nombre ne change tant qu'aucune rating n'est confirmée : sans rating, les formules donnent exactement les valeurs d'aujourd'hui.
- Les 5 parcours de la prod obtiennent une proposition sans intervention, sauf la confirmation.
- Une seule source de vérité de la rating par paire (nom, tees), appliquée à tous les rounds passés et futurs de cette paire.

**Non-Goals:**

- Garder la rating en vigueur à la date d'un round (WHS la fige par round). Le groupe veut que les rounds existants profitent de la rating ; une correction s'applique donc à tout l'historique.
- Une table « parcours » qui remplacerait `knownCourses` : les pars et index restent ceux du round le plus récent.
- Mettre en cache les images SGT sur le volume.

## Decisions

### 1. Formules en dixièmes, avec un repli exact

- **Différentiel** (`differentialTenths`) : `arrondi(113 × (ajusté × 10 − ratingT) / slope)`, arrondi au plus proche, 0,5 vers le haut (`Math.floor(x + 0.5)`, comme `roundIndexT`). Sans rating confirmée : `ratingT = par × 10`, `slope = 113`, ce qui redonne `(ajusté − par) × 10` à l'identique.
- **Handicap de parcours** (`courseHandicap`, remplace l'usage direct de `playingHandicap`) : `Math.floor((indexT × slope / 113 + ratingT − par × 10) / 10 + 0.5)`. Sans rating : `Math.floor(indexT / 10 + 0.5)`, la valeur actuelle. `playingHandicap` devient le cas particulier slope 113 / rating = par.
- Allocation à 100 % : le WHS recommande 95 % en stroke play individuel, mais le groupe joue des matchs en net ; changer l'allocation changerait les nombres même sans rating.

Contrôles faits à la main (Bethpage Black / Red, 71,4 / 144, par 71) : Manu ajusté 88 → 113 × 166 / 144 = 130,26 → **13,0** ; Gab 72 → 4,71 → **0,5**. Index 17,4 → 174 × 144 / 113 + 4 = 225,7 → **23** ; index 1,0 → 16,7 → **2** ; index −2,0 → −21,5 → **−2**.

Alternative écartée : stocker le handicap de jeu dans `player_round_stats`. Il dépend de la rating, qui change déjà tout l'historique ; le calculer à la lecture depuis `indexBeforeT` et la rating du round évite une colonne de plus à recalculer.

### 2. Table `course_ratings`, une ligne par paire (nom, tees)

Migration `0004` :

| Colonne | Rôle |
| --- | --- |
| `id` | clé |
| `course_name`, `tees` | texte tel que vu sur le premier round ; unicité sur `lower(trim(course_name))`, `lower(trim(tees))` |
| `rating_t`, `slope` | valeurs **confirmées**, `null` tant que rien n'est confirmé |
| `source` | `sgt` ou `manual`, `null` sans valeur confirmée |
| `status` | `pending`, `proposed`, `choose_course`, `choose_tee`, `manual`, `not_found`, `failed`, `confirmed` |
| `sgt_course_id` | parcours SGT retenu, `null` sinon |
| `sgt_course_name`, `sgt_course_location` | nom et lieu SGT du parcours retenu (slug The Course View, affichage de la confirmation), `null` sans parcours retenu |
| `candidates` | JSON : parcours SGT possibles `{id, name, location, par}[]` (`choose_course`) |
| `tees_read` | JSON : tees lus sur la carte SGT `{name, ratingT, slope}[]` |
| `proposed_tee` | tee de `tees_read` qui correspond aux tees du round |
| `note` | raison affichée (« Budget IA du mois atteint », « SGT injoignable »…) |
| `updated_at` | horodatage |

Les valeurs proposées vivent dans `tees_read` : seule la confirmation écrit `rating_t` et `slope`, donc aucun calcul n'utilise une valeur non vérifiée. Une ligne `confirmed` corrigée à la main reste `confirmed` avec `source = manual`.

`ratingFor(tx, courseName, tees, par)` (`src/server/courses/ratings.ts`) renvoie `{ ratingT, slope, rated }` pour la paire, avec le repli de la décision 1 sur le `par` total du round (`ratingT = par × 10`, `slope = 113`). `recomputePlayerStats` et le classement net l'appellent pour chaque round.

### 3. Job `course-rating` dans le worker

Payload `{ courseRatingId }`. Étapes :

1. Lire le par total du round le plus récent de la paire. Sans round sur la paire (supprimé ou renommé depuis) → `manual`, note « Aucun round sur ce parcours », sans requête ni exception. Charger la liste SGT (décision 4). Erreur réseau ou JSON absent → exception ; le runner réessaie une fois, puis `onFailed` met `status = failed`, `note = "SGT injoignable"`.
2. Correspondance (décision 4). Aucune → `not_found`. Plusieurs → `choose_course` avec `candidates`. Une → `sgt_course_id`, `sgt_course_name` et `sgt_course_location`.
3. Sans IA, ou budget insuffisant pour `MAX_RATING_COST` → `manual` avec la note (« Lecture IA désactivée » ou « Budget IA du mois atteint ») ; la page donne le lien de la carte SGT.
4. Télécharger `scorecard_{id}.jpg` et le lire avec `ClaudeRatingReader` (décision 5). Enregistrer l'usage, même en cas d'échec. Erreur, refus ou réponse invalide → `manual`, note « Lecture IA impossible ».
5. Associer le tee (décision 4). Trouvé → `proposed` avec `proposed_tee`. Sinon → `choose_tee`.

Le job n'écrit jamais `rating_t` / `slope`. Il est mis en file :

- à l'enregistrement d'un round (création ou correction) dont la paire (nom, tees) n'a pas encore de ligne : `saveRound` insère la ligne `pending` et le job dans la même transaction ;
- au démarrage du web, après les migrations : une ligne `pending` et un job par paire de `knownCourses` sans ligne (les rounds existants) ;
- par « Relancer la recherche » (id, nom et lieu SGT effacés) et par le choix d'un candidat SGT (id, nom et lieu du candidat écrits ; l'étape 2 est alors sautée).

Variable `SGT_LOOKUP` du worker (`on` par défaut, `off` possible, validée dans `src/lib/env.ts`) : à `off`, le job s'arrête avant l'étape 1 avec `status = manual` et la note « Recherche SGT désactivée ». Les e2e et la CI la mettent à `off`, pour ne jamais appeler SGT ; un groupe auto-hébergé qui ne veut aucune requête sortante fait de même. `createJobHandlers` sans options désactive aussi la recherche : seul `src/worker.ts` passe `SGT_LOOKUP`, et un test ou un script qui crée les gestionnaires n'appelle jamais SGT.

Alternative écartée : faire la recherche dans la requête web d'enregistrement. Elle ajoute jusqu'à une minute d'appel IA à l'enregistrement d'un round, et le web n'a pas la clé IA (`golf-web` ne reçoit pas `ANTHROPIC_API_KEY`).

### 4. Liste SGT, noms et tees

- **Liste** : `GET https://simulatorgolftour.com/courses`, délai 20 s, `User-Agent: golf-handicaps (+https://github.com/emmpaul/golf-handicaps)`. Extraction du bloc `courses-data` par expression régulière puis `JSON.parse`, validation zod de `cardUrl` et de chaque ligne (`id` entier, `nom` texte, `par` entier en 4e position). Gardée en mémoire du worker 24 h : le balayage de démarrage ne la télécharge qu'une fois.
- **Normalisation des noms** : minuscules, accents retirés (NFD), `&` → `and`, tout ce qui n'est pas lettre ou chiffre → espace, espaces réduits, préfixe `the ` retiré. « THE SANCTUARY » → `sanctuary`.
- **Correspondance** : noms normalisés égaux **et** même par que le round. Sans égalité exacte : les parcours dont le nom normalisé contient celui du round, ou l'inverse, au même par, 10 au plus, deviennent des candidats. Un seul candidat en sous-chaîne n'est pas retenu d'office : il passe aussi par `choose_course`.
- **Tees** : on retire de la fin des tees du round une distance (`/\s*\d+\s*(yd|yds|y|m)$/i`), puis on compare au nom de tee lu, sans casse ni espaces. « White 6023yd » → `white`.
- **Liens** : carte SGT `https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_{id}.jpg` ; The Course View `https://thecourseview.com/courses/<slug>`, slug = nom SGT en minuscules, suites de caractères non alphanumériques remplacées par `-`, tirets en bord retirés (« Diamond Hawk Golf Course & Pub » → `diamond-hawk-golf-course-pub`, observé). Le lien Course View est une aide : s'il mène à une page vide, rien ne casse.

Alternative écartée : The Course View comme source automatique. Son tableau est du texte propre, mais le contrôle anti-robot de Vercel bloque tout appel serveur, et passer outre irait contre la volonté du site.

### 5. Lecture de la carte SGT par Claude

`ClaudeRatingReader` (`src/ai/rating-reader.ts`), sur le modèle de `ClaudeCornerLocator` : l'image SGT est déjà un JPEG de 905×527, envoyée telle quelle. Schéma zod :

```ts
{ found: boolean, par: int, tees: { name: string, rating: number (40..90), slope: int (55..155) }[] }
```

Prompt : la ligne « Slope/Rating » au-dessus des colonnes de tees, au format `rating/slope`, une entrée par colonne de tee, nom tel qu'écrit. `found = false` si l'image n'est pas une carte SGT. Un `par` lu différent de celui du round met la ligne en `manual` avec la note « Par de la carte SGT différent ». Constantes dans `src/ai/model.ts` : `RATING_MAX_TOKENS = 1500`, `RATING_MAX_INPUT_TOKENS` mesuré sur la carte de Bethpage Black (fixture `tests/fixtures/sgt/scorecard_30.jpg`), `MAX_RATING_COST` dans `pricing.ts`, comme pour le cadrage.

Ce qui part chez Anthropic : une image publique de SGT. Aucune donnée du groupe (noms, scores) n'est envoyée.

Alternative écartée : Tesseract sur la ligne « Slope/Rating ». Les cases sont de couleurs différentes (texte blanc sur bleu, noir sur blanc), la position des colonnes varie avec le nombre de tees ; il faudrait un second lecteur à maintenir pour quelques appels par an à environ 1 ¢.

### 6. Confirmation et recalcul

Actions serveur de `/courses` : confirmer la proposition, choisir un tee de `tees_read`, choisir un candidat SGT, saisir à la main (rating 40,0 à 90,0 à une décimale, slope entier 55 à 155), relancer la recherche. Toute écriture de `rating_t` / `slope` se fait dans une transaction qui appelle `recomputeStats` pour tous les joueurs ayant un round sur cette paire, comme `saveRound`. Relancer la recherche ne touche pas aux valeurs confirmées.

### 7. Page `/courses` hors de la navigation principale

La spec `app-shell` fixe cinq sections et la barre du bas est pleine à 320 px. La page Parcours est atteinte par un lien « Parcours » en tête de `/rounds`, par la ligne de rating du round sur `/rounds/[id]`, et par la mention « sans rating » de `/strokes`. Le lien « Rounds » de la navigation la marque comme section courante.

## Risks / Trade-offs

- [SGT change le format de sa page ou de ses cartes] → la validation zod échoue, la ligne passe `failed` avec « SGT injoignable » ou `manual`, et la saisie manuelle reste possible. Test de parsing sur une copie réduite de la page dans `tests/fixtures/sgt/`.
- [Récupérer des données de SGT sans accord explicite] → une requête par parcours nouveau, avec un `User-Agent` qui nomme l'app, liste gardée 24 h ; le volume du groupe est de quelques parcours par mois. Si SGT le demande, le job s'arrête à l'étape 2 et la saisie manuelle reste.
- [Mauvais parcours SGT homonyme] → par identique exigé, et la page Parcours montre « SGT : <nom> · <lieu> » à côté du lien de la carte.
- [Lecture IA fausse] → rien n'est utilisé sans confirmation ; la page montre l'image SGT à côté des valeurs.
- [Les nombres de la prod changent d'un coup] → voulu ; changement **BREAKING** dans le CHANGELOG (`feat!:` ou note), et chaque confirmation est un acte explicite, parcours par parcours.
- [« Blue » et « Blue 6212yd » sont deux parcours] → chacun a sa ligne et sa confirmation ; la fusion des tees reste hors périmètre.
- [Rating appliquée à des rounds joués avant un changement de rating sur SGT] → accepté (Non-Goals).

## Migration Plan

1. Déployer : le web applique `0004`, puis met en file un job par paire existante (6 en prod). Le worker passe `EXPECTED_SCHEMA_VERSION` à la nouvelle version.
2. Tant que rien n'est confirmé, tous les nombres restent identiques (décision 1).
3. Ouvrir `/courses`, vérifier chaque proposition contre la carte SGT et confirmer.
4. Retour arrière : redéployer l'image précédente, sans autre étape. La migration `0004` n'ajoute que la table `course_ratings`, que l'ancienne version ignore. Les classements nets reviennent tout de suite à l'index arrondi, car ils sont calculés à l'affichage. Les différentiels et index, eux, sont stockés par joueur, et l'ancienne version ne recalcule l'historique d'un joueur qu'à l'enregistrement, la correction ou la suppression d'un de ses rounds : d'ici là, un joueur qui a joué un parcours confirmé garde les différentiels et index calculés avec sa rating.
