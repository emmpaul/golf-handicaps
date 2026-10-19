# Design

## Context

- La version vit dans `package.json` (`0.6.0`), tenue à jour par release-please. L'image publiée est construite depuis le commit de la release, donc son `package.json` porte la bonne version.
- Le build Docker ne voit pas `.git` (`.dockerignore`). Le job `docker` de `checks.yml` et `publish-image` de `main.yml` construisent avec `docker/build-push-action`, sans `build-args`. `docker-compose.yml` construit avec `build: .`.
- `decideAccess` (`src/lib/auth/access.ts`) ouvre `/login` et une liste exacte de chemins d'installation (`INSTALL_PATHS`), en `GET`/`HEAD` seulement. Sans session, toute autre `/api/*` reçoit 401.
- `src/app/(app)/layout.tsx` rend `AppNav` puis `main`, dont le bas laisse la place de la barre d'onglets (`--bottom-chrome`). `/login` est hors de ce layout et se prérend au build : une valeur lue au runtime n'y apparaîtrait pas.
- Les e2e tournent sur un build fait en CI sans `GIT_COMMIT` : ils voient `commit: null`.
- Le dépôt est public, en français, sans licence. Docs et specs restent en français ; seul ce qui s'adresse aux visiteurs (README, `docs/`, fichiers communautaires, modèles GitHub) passe en anglais.

## Goals / Non-Goals

**Goals:**
- Une seule source pour la version (`package.json`) et une seule pour le commit (`GIT_COMMIT` au build), lues par la route et par le pied de page.
- Même valeur dans les pages prérendues (`/login`) et dynamiques.

**Non-Goals:**
- Version du worker : il sort de la même image, la version du web suffit.
- Date de build : rend le build non reproductible pour un gain faible.
- Healthcheck compose sur `/api/version` : il resterait vert même si la base est inaccessible.

## Decisions

### 1. Commit inscrit au build par `next.config.ts`, pas lu au runtime

`next.config.ts` déclare `env: { GIT_COMMIT: process.env.GIT_COMMIT ?? "" }`. Next remplace `process.env.GIT_COMMIT` dans le bundle au build, donc `/login` prérendue et la route ont la même valeur.

- Alternative : `ENV GIT_COMMIT` dans l'étape runtime et lecture au runtime. Rejetée : `/login` prérendue au build ne la verrait pas, et un `GIT_COMMIT` posé à la main dans Dokploy pourrait mentir.
- Alternative : `git rev-parse` dans `next.config.ts`. Rejetée : pas de `.git` dans le contexte Docker, et en local la version seule suffit.

### 2. Module `src/lib/version.ts`, source unique

Exporte `APP_VERSION` (import de `package.json`, `resolveJsonModule` déjà actif), `APP_COMMIT` (`process.env.GIT_COMMIT` s'il correspond à `^[0-9a-f]{40}$`, sinon `null`) et `releaseUrl(version)` construit depuis `package.json` `repository.url` (`https://github.com/emmpaul/golf-handicaps`). La validation du sha protège la route d'une valeur vide ou fantaisiste passée en `build-arg`. Une fonction pure `parseCommit(raw)` porte la validation pour les tests unitaires.

### 3. Route `src/app/api/version/route.ts`

`GET` renvoie `Response.json({ version: APP_VERSION, commit: APP_COMMIT }, { headers: { "Cache-Control": "no-store" } })`. Seul `GET` est exporté ; l'accès ouvre `GET` et `HEAD` comme pour les autres chemins publics. Aucun accès à `getDb()`. `no-store` empêche un proxy de servir l'ancienne version juste après un déploiement.

### 4. Accès : `/api/version` dans une liste exacte de lecture publique

`INSTALL_PATHS` devient `PUBLIC_READ_PATHS`, qui ajoute `/api/version`, en gardant le principe d'une liste exacte : `/api/version/x` et `/api/versions` restent à 401. Le test table de `decideAccess` reçoit ces lignes.

- Alternative : préfixe `/api/public/`. Rejetée : un préfixe ouvrirait toute route future posée dessous.

### 5. Pied de page `AppVersion`, composant serveur à props

`src/components/app-version.tsx` reçoit `{ version, commit }` et rend un `<footer>` : `<a href={releaseUrl(version)}>v0.6.0 · 4794e1b</a>`, texte `text-xs text-muted-foreground`, centré. Le layout `(app)` le rend en dernier enfant de `main` (donc au-dessus de la barre d'onglets grâce au padding existant) ; `/login` le rend en bas de son `main`. Les props permettent un test de composant avec un commit connu, cas que les e2e ne voient pas.

### 6. CI et Docker

- `Dockerfile` : `ARG GIT_COMMIT=""` puis `ENV GIT_COMMIT=$GIT_COMMIT` dans l'étape `build`, avant `RUN pnpm build`. Le `COPY . .` invalide déjà le cache à chaque commit, l'`ARG` n'ajoute aucun rebuild.
- `checks.yml` job `docker` et `main.yml` `publish-image` : `build-args: GIT_COMMIT=${{ github.sha }}`. Sur une PR, `github.sha` est le commit de fusion ; le test de fumée compare donc à la même valeur.
- `main.yml` : `org.opencontainers.image.revision=${{ github.sha }}` dans les labels et annotations (image et index).
- `docker-compose.yml` : `build.args.GIT_COMMIT: ${GIT_COMMIT:-}`.
- Test de fumée compose : nouveau test qui lit `GET /api/version` sans session et compare `commit` à `EXPECTED_COMMIT`, passé par la CI ; absent, le test échoue avec un message qui nomme la variable (même modèle que `APP_PASSCODE`).

### 7. Docs publiques : README court, détail dans `docs/`

Le README actuel mêle présentation et exploitation du groupe. Le nouveau README en anglais présente le projet et renvoie à :

| Page | Contenu repris du README actuel |
| --- | --- |
| `docs/architecture.md` | web + worker, SQLite, file de jobs, OCR Tesseract, détection du panneau, schéma mermaid |
| `docs/ai-fallback.md` | Repli IA : cadrage, complétion, données envoyées, coûts, plafond, activation |
| `docs/deployment.md` | Dokploy, GHCR, variables, sauvegarde, retour arrière |
| `docs/ci.md` | contrôles, scope documentation, e2e en tranches, release-please, publication multi-arch |
| `docs/development.md` | prérequis, `pnpm` scripts, `ocr:debug`, compose local, photos DNG |
| `docs/roadmap.md` | contenu nouveau, rien de repris : Next, Later, Ideas, New feature ideas, Out of scope |

En tête du README, trois rangées de badges shields.io cliquables : état et release (dynamiques), pile technique avec versions majeures, les 8 topics ; le démarrage rapide finit par « Releases and image tags » (tags `vX.Y.Z`, tags GHCR, label `revision`, `GET /api/version`).

Une capture d'écran (accueil et classement, à 390 px et 1440 px) sous `docs/images/`, prise avec Playwright sur la base de `pnpm db:reset`, sans donnée réelle du groupe. Les noms seedés (Gab, Manu, Sean) sont déjà publics dans le dépôt.

### 8. Métadonnées du dépôt appliquées à la main

`gh repo edit` (description, topics) et `gh api -X PUT repos/emmpaul/golf-handicaps/private-vulnerability-reporting` sont visibles de l'extérieur : l'implémentation les propose et attend l'accord avant de les lancer, après fusion de la PR (le lien vers `SECURITY.md` doit exister).

## Risks / Trade-offs

- [`polish-mobile-ui` pas archivé, il modifie la même exigence d'`app-access`] → Archiver `polish-mobile-ui` avant ce change ; le delta d'ici reprend déjà son texte et ajoute les scénarios de version.
- [Image construite hors CI sans `GIT_COMMIT`] → Pied de page « v0.6.0 » seul, route `commit: null` : on sait encore la version.
- [`github.sha` sur une PR est un commit de fusion, absent de l'historique de `main`] → Seule l'image publiée compte ; elle se construit sur `main` avec le vrai sha.
- [Traduction des docs : une information perdue en route] → Tâche de relecture qui compare section par section l'ancien README aux pages `docs/`.
- [Changement de `package.json` hors `version` : la PR n'est pas classée documentation] → Voulu, le code change aussi.

## Migration Plan

Aucune migration de base. Déploiement habituel : release, puis redéploiement de `golf-web` et `golf-worker` dans Dokploy. Vérifier ensuite `curl https://<domaine>/api/version` : `version` et `commit` de la release. Retour arrière : tag précédent, la route disparaît sans effet sur les données.
