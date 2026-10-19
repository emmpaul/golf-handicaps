# Proposal

## Why

Après un déploiement Dokploy, rien ne dit quelle version tourne : il faut ouvrir Dokploy et lire le tag de l'image, et `latest` ne dit rien du tout. Au téléphone, on ne sait pas si un correctif est en ligne. Le dépôt GitHub est public, mais il ne se présente pas comme un projet public : README en français centré sur l'exploitation du groupe, aucune licence (donc aucun droit de réutilisation), aucun guide de contribution, aucune politique de sécurité, aucun modèle d'issue, et la description du dépôt dit « app privée ».

## What Changes

- **Route de version** `GET /api/version`, lisible sans session : `200` avec `{ "version": "0.6.0", "commit": "<sha de 40 caractères>" }`, `commit` à `null` quand le build ne le connaît pas (dev local). Réponse `Cache-Control: no-store`. Elle ne lit pas la base.
- **Version dans l'interface** : une ligne discrète en bas des pages de l'app et de `/login`, « v0.6.0 · 4794e1b » (7 premiers caractères du commit), liée à la release GitHub `v0.6.0`. Sans commit connu : « v0.6.0 » seul.
- **Commit connu dans l'image** : le build Docker reçoit le sha du commit (`GIT_COMMIT`) en CI, dans le job `docker` des contrôles et dans `publish-image`. L'image publiée porte aussi le label OCI `org.opencontainers.image.revision`.
- **Accès** : la route de version rejoint `/login` et les fichiers d'installation dans la liste exacte des chemins ouverts sans session. Elle ne donne aucune donnée du groupe ; la version et le commit sont déjà publics sur GitHub.
- **Dépôt prêt pour le public** (documentation seulement, l'interface reste en français) :
  - `README.md` réécrit en anglais : présentation, captures d'écran, trois rangées de badges shields.io cliquables (état et release, dynamiques ; pile technique avec versions majeures ; les 8 topics), fonctionnalités, démarrage rapide, architecture, liens vers la doc détaillée. Le démarrage rapide finit par une sous-section « Releases and image tags » : release-please, tags `vX.Y.Z`, tags GHCR `vX.Y.Z`, `latest` et sha, multi-arch, label OCI `revision`, `GET /api/version`.
  - Sections longues du README actuel (repli IA, déploiement Dokploy, CI et releases) déplacées et traduites dans `docs/` (`docs/architecture.md`, `docs/ai-fallback.md`, `docs/deployment.md`, `docs/ci.md`, `docs/development.md`), sans perte d'information. Nouvelle page `docs/roadmap.md` (Next, Later, Ideas, New feature ideas, Out of scope), liée depuis le README.
  - `LICENSE` MIT, champs `license`, `repository`, `homepage` et `bugs` dans `package.json`.
  - Fichiers communautaires : `CONTRIBUTING.md`, `SECURITY.md` (signalement privé via GitHub), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `SUPPORT.md`.
  - Modèles GitHub : formulaires d'issue (bug, idée) et `config.yml`, `CODEOWNERS`. Le modèle de PR existant reste.
  - Métadonnées du dépôt : description en anglais, topics, signalement privé de vulnérabilités activé. Appliquées avec `gh` pendant l'implémentation, après accord explicite (action visible de l'extérieur).
- Hors périmètre : traduire l'interface ou les specs, changer le healthcheck compose (il reste sur `/login`), afficher la version du worker, une page « À propos ».

## Capabilities

### New Capabilities

- `app-version` : route de version publique et affichage de la version dans l'interface.
- `public-repository` : ce que le dépôt public offre à un visiteur (licence, README en anglais, guides de contribution et de sécurité, modèles d'issue).

### Modified Capabilities

- `app-access` : « Accès protégé par code partagé » ajoute la route de version aux chemins ouverts sans session. Le texte part de celui de `polish-mobile-ui` (fichiers d'installation), pas encore archivé : archiver `polish-mobile-ui` avant ce change.

## Impact

- **Code** :
  - `src/lib/auth/access.ts` : `/api/version` en lecture dans la liste exacte des chemins publics.
  - Nouvelle route `src/app/api/version/route.ts` et module `src/lib/version.ts` (version tirée de `package.json`, commit de `GIT_COMMIT` inscrit au build).
  - `next.config.ts` : `env.GIT_COMMIT` inscrit au build.
  - Nouveau composant de pied de page, rendu par `src/app/(app)/layout.tsx` et `src/app/login/page.tsx`.
- **Build et CI** : `Dockerfile` (`ARG GIT_COMMIT` dans l'étape build), `.github/workflows/checks.yml` (job `docker`) et `main.yml` (`publish-image`, label `revision`).
- **Tests** : unitaires (`decideAccess`, module de version), e2e (route sans session, pied de page sur `/login` et une page de l'app), test de fumée compose (commit renseigné dans l'image).
- **Docs** : `README.md`, `docs/*.md` (dont `docs/roadmap.md`), `LICENSE`, fichiers communautaires, `.github/ISSUE_TEMPLATE/`, `.github/CODEOWNERS`, `package.json` (champs de métadonnées : la CI lance donc la suite complète), commentaire d'`ANTHROPIC_API_KEY` dans `.env.example` et `src/lib/env.ts` (il cite le cadrage en plus de la complétion).
- **Dépendances** : aucune.
