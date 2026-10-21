# Proposal

## Why

L'index du groupe ignore la difficulté du parcours : un différentiel vaut score ajusté moins par, avec un slope fixé à 113. Un 88 sur Bethpage Black (Red : course rating 71,4, slope 144) compte autant qu'un 88 sur un parcours facile au même par, et le handicap de jeu ne change pas d'un parcours à l'autre. Or les parcours GSPro ont presque tous une course rating et un slope par tee, publiés par Simulator Golf Tour (SGT) sur l'image de carte de chaque parcours, et repris par The Course View. Les 6 rounds de la prod (5 parcours) en ont tous une sur SGT.

## What Changes

- **Rating et slope par parcours et tees.** Chaque parcours connu (nom, tees) peut porter une course rating (une décimale) et un slope (entier). Une valeur n'entre dans les calculs qu'une fois confirmée par un utilisateur.
- **Recherche automatique sur SGT.** Pour un parcours sans rating, le worker cherche le nom dans la liste des parcours de SGT (`simulatorgolftour.com/courses`, JSON intégré à la page). Sur une correspondance unique au même par, il lit l'image de carte SGT du parcours avec Claude (même clé, même budget mensuel que le reste de l'IA) et propose la rating et le slope du tee qui correspond aux tees du round (« Blue 6212yd » → « Blue »). Plusieurs candidats : l'utilisateur choisit le bon. Sans clé IA ou budget atteint : l'app donne le lien de l'image de carte SGT et l'utilisateur saisit les valeurs.
- **Page Parcours** (`/courses`) : la liste des parcours connus avec leur rating, leur slope et l'état de la recherche ; confirmer une proposition, choisir un candidat, saisir ou corriger à la main, relancer la recherche. Liens vers la carte SGT et la page The Course View. Atteinte depuis les pages Rounds, round et Coups ; la navigation principale garde ses cinq sections.
- **Calcul WHS avec rating.** Différentiel = (113 / slope) × (score ajusté − course rating), arrondi au dixième. Handicap de jeu = index × slope / 113 + (course rating − par), arrondi à l'entier. Il sert au classement net d'un round et à la page Coups. **BREAKING** pour les nombres affichés : après confirmation des ratings, les différentiels, index, handicaps de jeu et classements nets de la prod changent.
- **Repli sans rating.** Un parcours sans rating confirmée garde le calcul actuel (course rating = par, slope 113), avec la mention « sans rating ».
- **Rounds existants.** Au démarrage, le worker lance la recherche pour chaque parcours connu sans rating. Toute confirmation ou correction recalcule l'historique des joueurs qui ont joué ce parcours.
- **Hors périmètre** : The Course View comme source automatique (bloqué par le contrôle anti-robot de Vercel, HTTP 429, à tout appel serveur), lecture locale par Tesseract de l'image SGT, allocation de 95 % en stroke play, net double bogey, PCC, caps, 9 trous, fusion des tees « Blue » et « Blue 6212yd » en un seul parcours.

## Capabilities

### New Capabilities

- `course-rating` : course rating et slope d'un parcours et de ses tees : recherche sur SGT, proposition, confirmation, saisie manuelle et page Parcours.

### Modified Capabilities

- `handicap-index` : le différentiel utilise la course rating et le slope confirmés du parcours, avec repli sur par et 113 ; le recalcul complet couvre aussi un changement de rating.
- `rounds` : le handicap de jeu du classement net devient le handicap de parcours (index, slope, rating et par du round) ; le round affiche la rating et le slope utilisés ou « sans rating ».
- `match-strokes` : le handicap de jeu de chaque joueur se calcule avec la rating et le slope du parcours choisi.

## Impact

- **Base** : nouvelle table `course_ratings` (migration Drizzle `0004`). Aucune colonne retirée.
- **Domaine** : `src/domain/handicap.ts` (différentiel avec rating), `src/domain/strokes.ts` (handicap de parcours).
- **Serveur** : `src/server/rounds/stats.ts` (rating par round), `leaderboard.ts`, `courses.ts`, nouveau `src/server/courses/` (ratings, recherche, recalcul).
- **Worker** : nouveau job `course-rating` (`src/jobs/`), appel IA `src/ai/rating-reader.ts`, balayage au démarrage. Requêtes HTTP sortantes vers `simulatorgolftour.com` depuis le worker.
- **UI** : page `/courses`, liens depuis `/rounds`, `/rounds/[id]` et `/strokes`, `strokes-planner.tsx`, `net-leaderboard.tsx`.
- **Docs** : `docs/architecture.md` (index), `docs/ai-fallback.md` (troisième appel IA), `docs/roadmap.md` (« Closer WHS rules »).
- **Dépendances** : aucune nouvelle.
