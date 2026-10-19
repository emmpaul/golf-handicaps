# Proposal

## Why

Le dépôt est public et l'image se déploie sur n'importe quel hôte Docker, mais quatre choses supposent encore notre groupe et notre serveur : la base vide reçoit Manu, Gab et Sean, le budget IA bascule de mois à l'heure de Montréal, un worker figé ne fait rien virer au rouge, et une session de 90 jours ne peut pas se fermer. Ce sont les quatre items « Ops and deployment » de la section Next de `docs/roadmap.md`.

## What Changes

- **Joueurs initiaux configurables** : nouvelle variable `INITIAL_PLAYERS` (noms séparés par des virgules, par exemple `Manu,Gab,Sean`), lue par le web. Sur une base sans joueur, le web crée ces joueurs, chacun avec son nom en majuscules pour alias. **BREAKING** pour une nouvelle installation : variable absente ou vide, aucun joueur n'est créé, le groupe les ajoute sur `/players`. Une base qui a déjà des joueurs (la prod actuelle) ne change pas. Deux noms identiques sans tenir compte de la casse font échouer le démarrage avec un message qui nomme la variable. `pnpm db:reset`, les tests et les e2e gardent Manu, Gab et Sean.
- **Fuseau du budget IA configurable** : nouvelle variable `AI_BUDGET_TIME_ZONE` (identifiant IANA, par exemple `Europe/Paris`), utilisée par le worker, `America/Montreal` par défaut. Le mois civil du plafond IA se compte dans ce fuseau. Un fuseau inconnu fait échouer le démarrage du web et du worker (validation partagée de l'environnement) avec un message qui nomme la variable. Les mois déjà enregistrés dans `ai_usage` ne sont pas recalculés.
- **Santé du worker** : le worker signale qu'il tourne à chaque tour de sa boucle, et le service `worker` de `docker-compose.yml` reçoit un healthcheck qui passe `unhealthy` quand ce signal a plus de 5 minutes (la durée après laquelle la file reprend déjà un job bloqué). `docker compose up --wait` attend donc aussi le worker, ce qui couvre le test de fumée de la CI. `docs/deployment.md` donne la même commande pour le healthcheck Dokploy de `golf-worker`.
- **Déconnexion** : un bouton « Se déconnecter » en bas de la page d'accueil efface le cookie de session de cet appareil et renvoie sur `/login`. Les autres appareils restent connectés ; fermer toutes les sessions reste la rotation de `SESSION_SECRET`, désormais documentée.
- **Docs** : `.env.example`, section « Configuration » du README, `docs/deployment.md` (variables, healthcheck, déconnexion de tous), `docs/ai-fallback.md` (fuseau), `docs/roadmap.md` (les quatre items quittent Next).
- Hors périmètre : export CSV, sauvegarde depuis l'app, vue des dépenses IA (idées Ops de la roadmap), révocation côté serveur d'une session précise, healthcheck dans le `Dockerfile` (une image, deux rôles).

## Capabilities

### New Capabilities

- `worker-health` : le worker signale qu'il tourne, et l'orchestrateur le voit malade quand il se fige.

### Modified Capabilities

- `players` : « Joueurs initiaux » crée les joueurs de `INITIAL_PLAYERS` au lieu de Manu, Gab et Sean, et aucun sans la variable.
- `scorecard-ai-completion` : « Plafond de dépense mensuel » compte le mois civil dans le fuseau configuré.
- `app-access` : nouvelle exigence « Fermeture de session ».
- `public-repository` : « Documentation détaillée sans perte », scénario « Variables d'environnement », ajoute `INITIAL_PLAYERS` et `AI_BUDGET_TIME_ZONE`.

## Impact

- **Code** :
  - `src/lib/env.ts` : `INITIAL_PLAYERS` (liste) et `AI_BUDGET_TIME_ZONE` (fuseau validé).
  - `src/server/players/seed.ts`, `src/db/prepare.ts`, `src/db/seeders.ts`, `src/instrumentation.ts` : la liste des noms devient un paramètre.
  - `src/ai/budget.ts`, `src/worker.ts` : fuseau passé au budget.
  - Nouveau module de battement du worker sous `src/jobs/`, appelé par `src/worker.ts`.
  - Nouvelle action serveur de déconnexion et bouton sur `src/app/(app)/page.tsx`.
- **Déploiement** : `docker-compose.yml` (healthcheck `worker`), `.github/workflows/checks.yml` (`INITIAL_PLAYERS` dans le `.env` du test de fumée compose, qui attend Gab et Manu). En prod, rien à changer pour la base existante ; ajouter le healthcheck de `golf-worker` dans Dokploy.
- **Tests** : unitaires (`parseEnv`, seed, budget, battement), e2e (déconnexion, `tests/e2e/data.ts`), test de fumée compose (worker sain).
- **Dépendances** : aucune.
