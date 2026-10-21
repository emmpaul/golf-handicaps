# Tasks

## 1. Formules avec rating (domaine)

- [ ] 1.1 Étendre `tests/domain/handicap.test.ts` (rouge d'abord) : `differentialTenths` avec rating 714 / slope 144 donne 5 pour Gab (72) et 130 pour Manu (88) ; sans rating (rating = par × 10, slope 113) il redonne 10 et 170 (spec `handicap-index`). Mutations à nommer : `slope` et `113` inversés, rating ignorée, `Math.round` remplacé par `Math.floor` sans `+ 0.5`.
- [ ] 1.2 Changer `differentialTenths` pour prendre `{ ratingT, slope }` (design, décision 1) ; adapter ses appelants. `pnpm test tests/domain` passe.
- [ ] 1.3 Étendre `tests/domain/strokes.test.ts` (rouge d'abord) : `courseHandicap` donne 2 pour l'index 10, 23 pour 174 et −2 pour −20 sur 714 / 144 / par 71, et 1 et 17 sans rating ; `matchStrokes` avec rating donne `[0, 21]` en « Écart » et `[2, 23]` en « Complet » (spec `match-strokes`). Mutation à nommer : `(ratingT − par × 10)` retiré.
- [ ] 1.4 Ajouter `courseHandicap` dans `src/domain/strokes.ts`, faire passer `matchStrokes` par lui avec une rating optionnelle. `pnpm test tests/domain` passe.

## 2. Table `course_ratings` et application aux rounds

- [ ] 2.1 Ajouter `courseRatings` à `src/db/schema.ts` (design, décision 2, statuts en `enum`), générer `drizzle/0004_*.sql` avec `pnpm drizzle-kit generate`, vérifier que `tests/db/migrate.test.ts` passe et que `EXPECTED_SCHEMA_VERSION` suit le journal.
- [ ] 2.2 Écrire `tests/server/courses/ratings.test.ts` (rouge d'abord) : `ratingFor` renvoie la rating confirmée sans tenir compte de la casse ni des espaces, le repli (par × 10, 113, `rated: false`) sans ligne ou avec une ligne `proposed`. Mutation à nommer : lire `tees_read` au lieu de `rating_t`.
- [ ] 2.3 Créer `src/server/courses/ratings.ts` (`ratingFor`) et l'utiliser dans `recomputePlayerStats`. Étendre `tests/server/rounds/stats.test.ts` (ou le test existant de `saveRound`) : la carte `IMG_3064` donne 1,0 / 17,0 sans rating et 0,5 / 13,0 avec 71,4 / 144 confirmé.
- [ ] 2.4 `roundLeaderboard` calcule le handicap de jeu avec `courseHandicap` et la rating du round. Test : Gab 1,0 / Manu 17,4 avant un round 72 / 88 rated → handicaps 2 et 23, nets 70 et 65, rangs 2 et 1 ; sans rating, scénario actuel inchangé (spec `rounds`).

## 3. Recherche SGT dans le worker

- [ ] 3.1 Ajouter les fixtures `tests/fixtures/sgt/courses.html` (page réduite à une dizaine de parcours, dont Bethpage Black 30, Paynes Valley 573 / 574, Sanctuary 477 / 3291 / 1873, avec le format réel du bloc `courses-data`) et `tests/fixtures/sgt/scorecard_30.jpg`, plus un `README.md` qui dit d'où elles viennent et quand.
- [ ] 3.2 Écrire `tests/server/courses/sgt.test.ts` (rouge d'abord) : parsing de la liste, normalisation (« THE SANCTUARY » → `sanctuary`), correspondance unique au même par (Bethpage Black → 30, Paynes Valley → 573, pas 574), candidats en sous-chaîne au même par, tees « White 6023yd » → `white`, slug Course View `diamond-hawk-golf-course-pub`. Mutations à nommer : préfixe `the` gardé, par ignoré.
- [ ] 3.3 Implémenter `src/server/courses/sgt.ts` (décision 4) : fetch avec délai et `User-Agent`, zod, cache 24 h injectable, liens carte et Course View. `pnpm test tests/server/courses` passe.
- [ ] 3.4 Écrire `tests/ai/rating-reader.test.ts` sur `tests/ai/fake-client.ts` : une réponse valide donne les tees en dixièmes (`71.4` → 714), slope 160 ou `found: false` sont rejetés ou donnent `null`, l'usage est rendu même sur `AiCompletionError`.
- [ ] 3.5 Créer `src/ai/rating-reader.ts` (décision 5), `RATING_MAX_TOKENS` / `RATING_MAX_INPUT_TOKENS` dans `model.ts`, `MAX_RATING_COST` dans `pricing.ts` avec un test dans `tests/ai/pricing.test.ts`. Mesurer une fois les tokens d'entrée réels sur `scorecard_30.jpg` avec une vraie clé et noter la mesure dans le commentaire de la constante.
- [ ] 3.6 Écrire `tests/jobs/course-rating.test.ts` (rouge d'abord), lecteur IA et liste SGT simulés : `proposed` avec tee Red pour Bethpage Black / Red, `choose_course` avec candidats, `not_found`, `choose_tee`, `manual` sans IA et avec budget insuffisant (aucun appel fait), usage enregistré dans `ai_usage`, `failed` + « SGT injoignable » après deux erreurs réseau, `manual` + « Recherche SGT désactivée » avec `SGT_LOOKUP=off`, et `rating_t` / `slope` jamais écrits.
- [ ] 3.7 Implémenter le handler `course-rating` (`src/jobs/course-rating.ts`, décision 3), l'enregistrer dans `createJobHandlers` et brancher le lecteur IA dans `src/worker.ts`. Ajouter `SGT_LOOKUP` à `src/lib/env.ts` avec son test dans `tests/lib/env.test.ts`, à `.env.example`, et `SGT_LOOKUP=off` au worker des e2e (`playwright.config.ts`) et de `docker-compose` de test s'il en lance un.

## 4. Mise en file : nouveaux parcours et rounds existants

- [ ] 4.1 Test (rouge d'abord) : `saveRound` sur une paire sans ligne insère une ligne `pending` et un job `course-rating` dans la même transaction ; un deuxième round sur la même paire, en autre casse, n'en ajoute pas ; une correction qui change le nom du parcours en ajoute un pour la nouvelle paire.
- [ ] 4.2 Implémenter la mise en file dans `src/server/rounds/save.ts` / `edit.ts`.
- [ ] 4.3 Test du balayage de démarrage (`enqueueMissingCourseRatings`) : sur une base aux 6 paires de la prod (tees « Blue » et « Blue 6212yd » distincts), 6 lignes et 6 jobs ; un second appel n'en ajoute aucun.
- [ ] 4.4 Appeler le balayage dans `src/instrumentation.ts` après les migrations, avec un journal « Recherches de rating mises en file : N ».

## 5. Page Parcours et actions

- [ ] 5.1 Tests des actions serveur (`src/app/(app)/courses/actions.ts`) : confirmer écrit `rating_t` / `slope` / `source = sgt` et recalcule les joueurs du parcours (différentiel de Manu sur `IMG_3064` 17,0 → 13,0) ; saisie manuelle refusée hors bornes avec « Rating entre 40,0 et 90,0 » ou « Slope entre 55 et 155 » ; choix de tee et de candidat ; relancer met `pending` sans toucher aux valeurs confirmées et met un job en file.
- [ ] 5.2 Créer `src/app/(app)/courses/page.tsx` et ses composants (shadcn existants) : nom, tees, rating confirmée ou « sans rating », état de recherche, proposition, liens carte SGT et The Course View, actions de 5.1. Vérifier à 320 px sans défilement horizontal (spec `app-shell`).
- [ ] 5.3 `NavLink` marque « Rounds » sur `/courses` ; étendre `tests/e2e/app-shell.spec.ts`.
- [ ] 5.4 Liens vers `/courses` : en tête de `/rounds`, ligne « Rating 71,4 · slope 144 » ou « Sans rating (par 72, slope 113) » sur `/rounds/[id]`, mention « sans rating » ou rating du parcours choisi sur `/strokes` (`strokes-planner.tsx`), qui passe la rating à `matchStrokes`.
- [ ] 5.5 E2E `tests/e2e/courses.spec.ts` (worker à `SGT_LOOKUP=off`, ligne `proposed` insérée par `tests/e2e/data.ts`) : confirmer 71,4 / 144 sur la page Parcours, puis le round de référence montre Manu premier en net (65) et `/strokes` donne 21 coups à Manu en « Écart ». Étendre `rounds.spec.ts` et `strokes.spec.ts` pour l'affichage « sans rating ».

## 6. Documentation

- [ ] 6.1 `docs/architecture.md`, section « Handicap index » : formules avec rating, repli, source SGT, page Parcours ; ajouter `src/server/courses/` au tableau des sources.
- [ ] 6.2 `docs/ai-fallback.md` : troisième appel (lecture de la carte SGT) : quand, ce qui est envoyé (image publique SGT, rien du groupe), coût mesuré en 3.5, pire coût `MAX_RATING_COST`, comportement sans clé ou budget atteint.
- [ ] 6.3 `docs/deployment.md` et README (configuration) : `SGT_LOOKUP`, requêtes sortantes vers `simulatorgolftour.com`, étapes de mise en prod (design, Migration Plan) et retour arrière.
- [ ] 6.4 `docs/roadmap.md` : « Closer WHS rules » ne garde que 9 trous, caps, PCC, net double bogey et 95 % ; mettre à jour « Last updated ».

## 7. Vérification d'ensemble

- [ ] 7.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm jscpd`, `pnpm check:pins` et `pnpm e2e` passent ; `openspec validate add-course-rating --strict` passe.
- [ ] 7.2 En local avec une vraie clé IA et `SGT_LOOKUP=on`, sur une copie de la base de prod : les 6 recherches aboutissent (5 `proposed`, valeurs identiques aux cartes SGT ; « The Sanctuary » sur le parcours SGT 477), aucun nombre ne change avant confirmation, et chaque confirmation change les différentiels attendus.

## Workflow follow-up

- Après fusion et déploiement : ouvrir `/courses` en prod, vérifier chaque proposition contre sa carte SGT et confirmer.
- Avant l'archive : mettre à jour la Purpose de `openspec/specs/handicap-index/spec.md`, qui dit « ni course rating ni slope ».
- Archiver le change une fois la revue faite.
