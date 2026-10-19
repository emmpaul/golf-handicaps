# Design

## Context

Voir `proposal.md` pour la motivation. État observé :

- `biome.json` formate avec 2 espaces et une largeur de 100. `formatter.useEditorconfig` n'y est pas déclaré, et vaut `false` par défaut dans Biome 2.5 (schéma de `@biomejs/biome`). Tous les fichiers suivis sont en LF (`git ls-files --eol`), aucun Markdown n'a d'espaces en fin de ligne, il n'y a pas de `.gitattributes`.
- `pnpm db:reset` → `resetDatabase` applique `localSeeders` : `seedInitialPlayers(db, DEV_PLAYERS)` puis `seedReferenceRound`, qui passe par `saveRound` (contrôles de cohérence, puis `recomputeStats` des joueurs du round). Seuls `tests/server/rounds/seed.test.ts` et `tests/db/reset.test.ts` utilisent `localSeeders` ; les e2e passent par `prepareDatabase` et les tests unitaires par `tests/factories.ts`.
- `listRounds` trie par `playedOn` décroissant, puis `createdAt`, puis `id`.
- `playwright.config.ts` : sans `E2E_PREBUILT=1`, le serveur web lance `pnpm build && pnpm start`. Le worker des e2e tourne toujours avec `pnpm exec tsx src/worker.ts`, donc depuis les sources. Deux projets : `chromium` et `webkit-iphone` (seulement les specs de `MOBILE_SPECS`).
- Worker : `pnpm dev:worker` = `tsx watch --env-file-if-exists=.env --env-file-if-exists=.env.local src/worker.ts`. Un job échoue définitivement après `MAX_ATTEMPTS` (2) et garde `last_error` ; l'import passe alors en `failed`. `recropImport` remet un import `failed` dans la file (page « Recadrer la photo »). Les photos sont sous `DATA_DIR/uploads/<uuid>.webp`, `DATA_DIR` vaut `./data` en local.

## Goals / Non-Goals

**Goals:**

- Un `.editorconfig` qui ne peut pas diverger de `biome.json` sans faire échouer `pnpm test`.
- Des données locales qui montrent les index définitifs, un index provisoire, des courbes à plusieurs points et plusieurs parcours pour le préremplissage de `/rounds/new`.
- Deux sections de `docs/development.md` que l'on peut suivre commande par commande.

**Non-Goals:**

- Changer le comportement de l'app, du worker ou des e2e.
- Ajouter des scripts `package.json` (`e2e:fast`, `dev:worker:inspect`) ou un `launch.json` : les commandes documentées suffisent et ne coûtent aucune maintenance.
- Seed d'imports (en attente, en échec) : c'est l'idée « Fixture seed from photos » de la roadmap.

## Decisions

### 1. Biome reste la référence, `.editorconfig` la recopie

Contenu prévu :

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
max_line_length = 100
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`[*.md]` garde les deux espaces d'un saut de ligne Markdown, même si le dépôt n'en a aucun aujourd'hui.

Alternative écartée : activer `formatter.useEditorconfig` et retirer `indentWidth` / `lineWidth` de `biome.json`. Le formateur dépendrait d'un fichier que la plupart des contributeurs ne regardent pas, et l'extension VS Code lit déjà `biome.json`.

Garde-fou : un test Vitest (`tests/editorconfig.test.ts`) lit `.editorconfig` et `biome.json` et vérifie que la section `[*]` donne `indent_style = space`, `indent_size` égal à `formatter.indentWidth`, `max_line_length` égal à `formatter.lineWidth`, `end_of_line = lf` et `charset = utf-8`. Le parseur INI tient en quelques lignes dans le test, sans dépendance. Mutation qui le fait virer au rouge : `indentWidth: 4` dans `biome.json`, ou `max_line_length = 120` dans `.editorconfig`.

### 2. Rounds d'historique en littéraux, après le round de référence

Un nouveau seeder `seedSampleRounds` dans `src/server/rounds/seed.ts`, à côté de `seedReferenceRound`, avec les mêmes formes de données (pars, indexes, distances, une ligne de coups par joueur). `localSeeders` devient `[joueurs, seedReferenceRound, seedSampleRounds]`.

- **Le round de référence reste l'id 1** : il est créé en premier, les rounds d'historique sont datés avant le 2026-10-17. `saveRound` recalcule tout l'historique d'index à chaque ajout (spec `handicap-index`, « Recalcul complet »), donc l'ordre d'insertion ne change pas le résultat. Le test existant (« 1 2026-10-17 BETHPAGE BLACK / Red : Gab 72, Manu 88 ») garde sa première ligne.
- **Volume** : 7 rounds d'historique, de juillet à octobre 2026, sur BETHPAGE BLACK / Red et deux autres parcours GSPro (par exemple TPC SAWGRASS / Blue et PEBBLE BEACH / White), chacun avec ses pars, indexes et distances. Gab et Manu jouent les 7 (8 rounds en tout avec la référence : l'index retient les 2 meilleurs différentiels sur 8), Sean en joue 2 (index provisoire). Les coups de chaque trou sont écrits à la main, autour des scores de la carte de référence (Gab entre 70 et 80, Manu entre 84 et 96, Sean entre 95 et 105), sans trou au-delà de par + 4 sauf un, pour que le score ajusté se voie une fois.
- **Passage par `saveRound`** et non par des insertions SQL : les rounds passent les mêmes contrôles qu'un vrai round, et les stats sont celles de l'app.

Alternative écartée : générer les coups (par + bruit pseudo-aléatoire). Moins de lignes, mais les index attendus ne s'écrivent plus à la main depuis la table, et un changement du générateur change toutes les données d'un coup.

Le test de `pnpm db:reset` liste les 8 rounds (date, parcours, brut par joueur) et les index finaux de Gab, Manu et Sean comme littéraux calculés à la main depuis les différentiels et la table WHS de la spec, avec la mention provisoire de Sean.

### 3. Docs : deux sections dans `docs/development.md`, en anglais

**« Fast e2e runs »** :

```sh
pnpm build                                              # once, and after each change to the web app
E2E_PREBUILT=1 pnpm e2e tests/e2e/rounds.spec.ts        # one spec file, no build
E2E_PREBUILT=1 pnpm e2e --project chromium -g "index"   # one project, tests whose title matches
```

Avec : le worker des e2e tourne depuis `src/`, donc un changement du worker seul ne demande pas de rebuild ; un changement sous `src/app`, `src/components` ou de ce que le web importe en demande un ; `webkit-iphone` ne lance que les specs mobiles et demande `pnpm exec playwright install webkit` une fois.

**« Debugging the worker »** :

- Lire la file : `sqlite3 data/app.db "SELECT id, type, status, attempts, last_error FROM jobs ORDER BY id DESC LIMIT 10;"` et `SELECT id, status, photo_path, ai_note FROM imports ORDER BY id DESC LIMIT 10;`. La base est en WAL, la lecture marche pendant que `pnpm dev` tourne.
- Relancer un import en échec : « Recadrer la photo » sur l'import, qui le remet dans la file avec les coins choisis. Pas de requête `UPDATE` documentée : elle contournerait ce que fait `recropImport` dans la même transaction (statut, coins, correction effacée, job ajouté).
- Rejouer la lecture hors worker : `pnpm ocr:debug data/uploads/<uuid>.webp`, le `photo_path` de l'import.
- Débogueur : lancer le web et le worker séparément, `pnpm exec next dev` dans un terminal et `pnpm exec tsx watch --inspect --env-file-if-exists=.env --env-file-if-exists=.env.local src/worker.ts` dans l'autre, puis s'attacher depuis VS Code (« Attach to Node Process ») ou `chrome://inspect`.

La ligne `pnpm db:reset` de la section « Run the app » et du tableau des commandes décrit les nouvelles données.

## Risks / Trade-offs

- [Les rounds d'historique deviennent faux si une règle de contrôle de cohérence se durcit] → Ils passent par `saveRound`, donc `pnpm db:reset` et son test échouent tout de suite, au lieu de laisser des données invalides.
- [`tsx watch --inspect` peut ne pas transmettre le drapeau ou rouvrir le port à chaque redémarrage] → La tâche de doc exige de lancer la commande et de s'attacher une fois avant de l'écrire ; si `watch` gêne, la doc donne `tsx --inspect` sans `watch`.
- [`sqlite3` n'est pas installé partout] → La doc le dit (paquet `sqlite3` sur Debian/Ubuntu, présent sur macOS) ; la lecture n'est qu'une aide, l'app montre déjà le statut.
- [Un éditeur qui applique `max_line_length` en coupant les lignes] → Rare et désactivable ; Biome reformate au commit de toute façon.
