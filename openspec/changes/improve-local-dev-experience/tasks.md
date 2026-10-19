# Tasks

## 1. `.editorconfig`

- [ ] 1.1 Écrire `tests/editorconfig.test.ts` (TDD, rouge d'abord : le fichier n'existe pas) : il lit `.editorconfig` et `biome.json`, et vérifie pour `[*]` `root = true`, `charset = utf-8`, `end_of_line = lf`, `insert_final_newline = true`, `indent_style = space`, `indent_size` égal à `formatter.indentWidth` et `max_line_length` égal à `formatter.lineWidth` (design, décision 1). Vérifier qu'il échoue parce que `.editorconfig` manque.
- [ ] 1.2 Créer `.editorconfig` avec le contenu de la décision 1 ; `pnpm test tests/editorconfig.test.ts` passe. Appliquer un moment `indentWidth: 4` dans `biome.json`, voir le test virer au rouge, revenir.
- [ ] 1.3 `pnpm lint` passe sans changement de fichier (Biome ignore `.editorconfig` tant que `useEditorconfig` est absent).

## 2. Rounds d'historique dans `pnpm db:reset`

- [ ] 2.1 Choisir les 7 rounds d'historique (dates de juillet au 2026-10-16, trois parcours, Gab et Manu sur les 7, Sean sur 2, un trou au-delà de par + 4), puis calculer à la main les bruts, les différentiels et les index finaux de Gab, Manu et Sean depuis la table de la spec `handicap-index`. Garder ce calcul dans le commentaire du test.
- [ ] 2.2 Étendre `tests/server/rounds/seed.test.ts` (rouge d'abord) : après `resetDatabase`, `listRounds` donne les 8 lignes « id date parcours / tees : joueur brut, … » en littéraux, le round de référence en tête ; les index de Gab et Manu sont les littéraux de 2.1 sans mention provisoire, celui de Sean avec ; la courbe de Gab a 8 points datés. Mutations à nommer : un round d'historique retiré de `localSeeders`, un coup changé dans une ligne.
- [ ] 2.3 Ajouter `seedSampleRounds` dans `src/server/rounds/seed.ts` (mêmes formes que `REFERENCE_ROUND`, passage par `saveRound`) et l'ajouter après `seedReferenceRound` dans `src/db/seeders.ts`. `pnpm test` passe, y compris `tests/db/reset.test.ts` (Gab, Manu, Sean) inchangé.
- [ ] 2.4 `pnpm db:reset && pnpm dev`, puis vérifier dans le navigateur : `/handicaps` montre deux index définitifs et celui de Sean « (provisoire) », la courbe de Gab a 8 points, `/strokes` propose les trois joueurs avec leur index, `/rounds/new` préremplit les trois parcours.
- [ ] 2.5 Mettre à jour la description de `pnpm db:reset` dans `docs/development.md` (« Run the app » et tableau des commandes) : joueurs, round de référence et historique.

## 3. Documentation des e2e rapides

- [ ] 3.1 Ajouter la section « Fast e2e runs » à `docs/development.md` (design, décision 3) et la lier depuis la ligne `pnpm e2e` du tableau. Lancer chaque commande telle qu'écrite : après `pnpm build`, `E2E_PREBUILT=1 pnpm e2e tests/e2e/rounds.spec.ts` démarre sans lancer `next build` et passe ; `--project chromium -g` ne lance que les tests attendus.

## 4. Documentation du débogage du worker

- [ ] 4.1 Ajouter la section « Debugging the worker » à `docs/development.md` (design, décision 3), à côté de `pnpm ocr:debug`. Lancer les deux requêtes `sqlite3` sur une base où un import a échoué (par exemple la photo `tests/fixtures/scorecards/gspro-tualatin.jpg` sans clé IA) et vérifier qu'elles montrent le job `failed` et son `last_error`.
- [ ] 4.2 Vérifier « Recadrer la photo » sur cet import : il repasse « En attente » puis est relu par le worker.
- [ ] 4.3 Lancer la commande du worker avec `--inspect`, s'attacher depuis VS Code ou `chrome://inspect`, poser un point d'arrêt dans `src/jobs/runner.ts` et le voir atteint en important une photo. Si `tsx watch` ne garde pas l'inspecteur, documenter `tsx --inspect` sans `watch` à la place.

## 5. Roadmap et vérification d'ensemble

- [ ] 5.1 Retirer les quatre items et le sous-titre « Developer experience » de la section Next de `docs/roadmap.md`, mettre à jour « Last updated ».
- [ ] 5.2 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm jscpd` et `pnpm check:pins` passent ; `openspec validate improve-local-dev-experience --strict` passe.

## Workflow follow-up

- Ouvrir la PR depuis une branche `feat/local-dev-experience`, fusionner une fois la CI verte.
- Archiver le change dans une PR `chore(openspec): archive improve-local-dev-experience`.
