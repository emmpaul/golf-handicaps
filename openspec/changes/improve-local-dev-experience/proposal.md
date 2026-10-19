# Proposal

## Why

Un contributeur qui clone le dépôt tombe sur quatre frictions : son éditeur, s'il n'est pas VS Code, indente et termine les lignes à sa façon jusqu'au commit ; `pnpm e2e` refait un build complet à chaque lancement ; la base de `pnpm db:reset` n'a qu'un round, donc tous les index sont provisoires et chaque courbe n'a qu'un point ; et rien n'explique comment suivre la file de jobs ou déboguer le worker. Ce sont les quatre items « Developer experience » de la section Next de `docs/roadmap.md`.

## What Changes

- **`.editorconfig`** à la racine, aligné sur le formateur de `biome.json` : UTF-8, fins de ligne LF, retour final, indentation à 2 espaces, largeur 100. Biome reste la référence (`useEditorconfig` reste à `false`) ; un test unitaire fait échouer la CI si les deux fichiers divergent.
- **Données locales plus riches** : `pnpm db:reset` crée, en plus du round de référence `IMG_3064`, un historique de rounds datés de l'été et de l'automne 2026 sur trois parcours. Gab et Manu ont un index définitif et une courbe à plusieurs points, Sean un index provisoire. Les joueurs restent Gab, Manu et Sean, et le round de référence reste le plus récent. Les tests et les e2e, qui n'utilisent pas ces données, ne changent pas.
- **`docs/development.md`** :
  - nouvelle section sur les e2e rapides en local : un `pnpm build` puis `E2E_PREBUILT=1`, un seul fichier de spec, un seul projet Playwright, `-g`, et quand reconstruire (le web vient du build, le worker tourne depuis `src/`) ;
  - nouvelle section sur le débogage du worker : lire la file `jobs` et les `imports` avec `sqlite3`, relancer un import en échec par « Recadrer la photo », repasser la photo stockée dans `pnpm ocr:debug`, et lancer le worker seul avec `--inspect` pour attacher un débogueur ;
  - la ligne `pnpm db:reset` décrit les nouvelles données.
- **`docs/roadmap.md`** : les quatre items quittent la section Next.
- Hors périmètre : les items « Developer experience » de Later (toolchain épinglée, couverture) et de « New feature ideas » (`pnpm setup`, aperçu des composants, seed depuis les photos de fixtures). Pas de nouveau script `package.json` ni de `launch.json` VS Code.

## Capabilities

### New Capabilities

- `local-development` : ce que le dépôt fournit à un contributeur sur sa machine (réglages d'éditeur, données locales, documentation des e2e rapides et du débogage du worker).

### Modified Capabilities

Aucune. Le scénario « Base locale recréée » de `players` (Gab, Manu et Sean après `pnpm db:reset`) reste vrai tel quel.

## Impact

- **Code** : `src/server/rounds/seed.ts` (rounds d'historique), `src/db/seeders.ts` (ordre des seeders). Aucun changement de l'app ni du worker.
- **Configuration** : nouveau `.editorconfig`. `biome.json` inchangé.
- **Tests** : `tests/server/rounds/seed.test.ts` (rounds et index après `pnpm db:reset`), nouveau test de cohérence `.editorconfig` / `biome.json`.
- **Docs** : `docs/development.md`, `docs/roadmap.md`.
- **CI** : `.editorconfig` n'est pas un fichier de documentation pour `scripts/ci-scope.ts`, donc la PR lance la suite complète. Rien à changer.
- **Dépendances** : aucune.
