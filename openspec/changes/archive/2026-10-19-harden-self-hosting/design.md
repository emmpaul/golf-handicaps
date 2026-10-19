# Design

## Context

- `parseEnv` (`src/lib/env.ts`) valide un seul schéma zod pour le web et le worker. Une erreur nomme la variable ; `assertEnvOrExit` arrête le processus. Une variable vide dans Dokploy vaut absente (`AI_MONTHLY_BUDGET_USD`).
- Le web crée les joueurs au démarrage : `src/instrumentation.ts` → `prepareDatabase(db)` → `seedInitialPlayers(db)`, qui lit une constante `["Manu", "Gab", "Sean"]` et ne fait rien si la table `players` a une ligne. Le même seeder sert à `pnpm db:reset` (`localSeeders`), aux tests (`tests/factories.ts`, plusieurs tests sous `tests/server/players` et `tests/app/api`) et aux e2e (`tests/e2e/data.ts` appelle `prepareDatabase` après avoir vidé les tables).
- Le test de fumée compose (`tests/compose/compose.spec.ts`) importe la carte de référence et attend « Gab 72 » et « Manu 88 » : il dépend des joueurs initiaux. Son `.env` est écrit dans `checks.yml` avec `APP_PASSCODE` et `SESSION_SECRET` seulement.
- `AiBudget` (`src/ai/budget.ts`) calcule le mois `YYYY-MM` avec un `Intl.DateTimeFormat` figé sur `America/Montreal`, et l'écrit dans `ai_usage.month`.
- Le worker tourne dans `startWorkerLoop` : `runOnce` à la suite tant qu'il y a du travail, sinon pause de 1 s. Un job reste `running` ; la file le reprend après `STALE_AFTER_MS` = 5 min (`src/jobs/queue.ts`). Un appel Claude peut bloquer environ 120 s.
- `docker-compose.yml` : healthcheck `node -e "fetch(...)"` sur `web` seulement ; `worker` lance `node worker.js`, utilisateur `node`. En prod, deux applications Dokploy (Swarm), sans compose.
- Session : jeton HMAC sans état (`src/lib/auth/session.ts`), cookie `golf_session`, `path: "/"`. Aucun stockage serveur des sessions.

## Goals / Non-Goals

**Goals:**
- Une seule liste de joueurs par défaut pour le développement, les tests et les e2e, distincte de la configuration de production.
- Battement du worker testable sans Docker, et un healthcheck compose qui n'ajoute aucun fichier à l'image.

**Non-Goals:**
- Révoquer une session précise côté serveur : demanderait une table de sessions, pour un groupe qui partage un code.
- Redémarrer automatiquement un worker malade sous compose : `restart: unless-stopped` ne réagit pas à `unhealthy`. Dokploy (Swarm) le fait.

## Decisions

### 1. `INITIAL_PLAYERS` parsé dans `parseEnv`, liste passée au seeder

`parseEnv` transforme la chaîne en `string[]` : découpe sur `,`, `trim`, noms vides retirés ; absente ou vide → `[]`. Un `superRefine` rejette deux noms égaux sans casse, avec le chemin `INITIAL_PLAYERS` pour que le message existant nomme la variable. `Env.INITIAL_PLAYERS: readonly string[]`.

`seedInitialPlayers(db, names)` prend la liste ; `prepareDatabase(db, initialPlayers)` la relaie ; `instrumentation.ts` passe `getEnv().INITIAL_PLAYERS`. `seed.ts` exporte `DEV_PLAYERS = ["Manu", "Gab", "Sean"]`, utilisé par `localSeeders`, `tests/factories.ts`, les tests unitaires et `tests/e2e/data.ts`. `pnpm db:reset` ne dépend donc pas de `.env.local`.

- Alternative : défaut `Manu,Gab,Sean` quand la variable manque. Rejetée par le propriétaire : un autre groupe hériterait de trois inconnus.
- Alternative : lire `process.env` dans `seed.ts`. Rejetée : contourne la validation au démarrage et rend les tests dépendants de l'environnement.

### 2. Fuseau validé par `Intl.DateTimeFormat`, porté par `AiBudget`

`parseEnv` accepte `AI_BUDGET_TIME_ZONE` (vide → absente → `"America/Montreal"`) et la valide en construisant `new Intl.DateTimeFormat("en-CA", { timeZone })` : un `RangeError` devient une erreur zod sur ce chemin. `AiBudget` reçoit le fuseau au constructeur (`new AiBudget(db, monthlyUsd, timeZone)`) et construit son format une fois ; `montrealMonth` devient `calendarMonth(now, format)`.

- Alternative : `Intl.supportedValuesOf("timeZone")`. Rejetée : la liste ne contient que les noms canoniques, et `America/Montreal` (lien vers `America/Toronto`) y manque. Le défaut actuel serait refusé.
- Alternative : variable `TZ` du processus. Rejetée : change l'heure de tout le worker et des journaux, et l'image tourne en UTC, donc le défaut changerait.

### 3. Battement : fichier dans le `tmpdir` du conteneur, écrit avant chaque tour

Nouveau module `src/jobs/heartbeat.ts` : `HEARTBEAT_FILE` = `join(tmpdir(), "golf-worker-heartbeat")`, `writeHeartbeat(file, now)` écrit `String(now.getTime())`, `isHeartbeatFresh(file, now, maxAgeMs)` relit le nombre et renvoie `false` si le fichier manque, est illisible ou trop vieux. `src/worker.ts` appelle `writeHeartbeat` au début de son `runOnce`, avant `checkSchema()` : le battement couvre l'attente des migrations, la file vide (un battement par seconde) et chaque job (un battement à la fin, au tour suivant). Une erreur d'écriture est journalisée par `onError` sans arrêter la boucle.

Le fichier vit dans `/tmp` du conteneur, pas dans `/data` : un nouveau conteneur ne voit jamais le battement de l'ancien, et le web, qui partage le volume, n'en écrit pas.

Seuil : `STALE_AFTER_MS` (5 min). Au-delà, la file considère déjà le job comme abandonné ; un job plus court, même avec l'appel Claude, ne fait pas virer le worker au rouge.

- Alternative : battement sur un `setInterval` indépendant de la boucle. Rejetée : il bat encore quand un `await` de job ne revient jamais, le cas qu'on veut voir.
- Alternative : battement dans une table SQLite. Rejetée : écriture chaque seconde dans la base partagée, et le healthcheck devrait ouvrir SQLite.

### 4. Healthcheck compose en ligne, comme celui du web

`worker.healthcheck.test` : `node -e` qui lit `/tmp/golf-worker-heartbeat` et sort `0` si `Date.now() - t < 300000`, `1` sinon (fichier absent compris). `interval: 30s`, `timeout: 5s`, `retries: 3`, `start_period: 30s`. Un commentaire renvoie à `STALE_AFTER_MS` et à `src/jobs/heartbeat.ts`. `docker compose up --wait` attend alors les deux services, donc le test de fumée de la CI couvre le chemin du fichier et le format du nombre.

Le chemin en dur suppose `os.tmpdir()` = `/tmp` dans l'image (Node sur Linux sans `TMPDIR`). La tâche de vérification le contrôle dans le conteneur.

- Alternative : `node worker.js --healthcheck`. Rejetée : `worker.js` ouvre la base et valide l'environnement au chargement ; il faudrait réorganiser l'entrée pour un gain faible.
- Alternative : `HEALTHCHECK` dans le `Dockerfile`. Rejetée : la même image fait le web et le worker.

### 5. Déconnexion : action serveur et formulaire sur l'accueil

`src/app/(app)/actions.ts` exporte `logout()` (`"use server"`) : `(await cookies()).delete(SESSION_COOKIE_NAME)` puis `redirect("/login")`, comme le guide d'authentification de Next (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`). Composant `LogoutButton` (`src/components/logout-button.tsx`) : `<form action={logout}>` avec un `Button` `variant="ghost"` « Se déconnecter », zone de toucher de 44 px sous 768 px comme les autres contrôles de `main`, rendu en bas de `src/app/(app)/page.tsx` après la liste des sections. Le proxy laisse passer l'action (session valide) ; sans session elle reçoit déjà 401.

- Alternative : route `POST /api/logout`. Rejetée : un formulaire vers une action serveur reçoit la protection d'origine de Next sans code en plus.

## Risks / Trade-offs

- [Un jeton copié reste valide jusqu'à son expiration après la déconnexion] → Le jeton est sans état. La doc de déploiement dit que changer `SESSION_SECRET` ferme toutes les sessions.
- [Nouvelle installation sans `INITIAL_PLAYERS` : base vide] → Comportement voulu. `.env.example` et `docs/deployment.md` montrent `INITIAL_PLAYERS=` avec un exemple.
- [Seuil de 5 min dupliqué entre `STALE_AFTER_MS` et le healthcheck] → Commentaire croisé dans les deux fichiers.
- [Changer `AI_BUDGET_TIME_ZONE` en cours de mois décale les bornes de ce mois] → Les lignes déjà écrites gardent leur `month`. Écart de quelques heures sur un plafond de 1 $, documenté dans `docs/ai-fallback.md`.
- [Battement chaque seconde, écriture disque] → Quelques octets dans `/tmp` (overlay du conteneur), négligeable.

## Migration Plan

1. Déployer la release (web puis worker, comme d'habitude). La base de prod a des joueurs : `INITIAL_PLAYERS` n'a aucun effet, inutile de l'ajouter.
2. Dans Dokploy, `golf-worker` → Advanced → Swarm Settings → Health Check : même commande que compose (donnée dans `docs/deployment.md`), puis redéployer `golf-worker`.
3. Retour arrière : redéployer le tag précédent. Aucune migration de base. Le healthcheck Dokploy doit alors être retiré, l'ancienne image n'écrivant pas de battement.
