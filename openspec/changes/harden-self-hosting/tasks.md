# Tasks

Règle pour tout le change : TDD pour le code. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après les specs (`["Gab", "Manu", "Sean"]`, `"2026-11"`, `"Se déconnecter"`). Chaque test nomme la mutation qui le fait rougir. `pnpm jscpd` reste à 0 %, chaque commit passe commitlint. Branche `feat/harden-self-hosting` depuis `origin/main`.

## 1. Joueurs initiaux configurables (spec `players`)

- [ ] 1.1 TDD : `INITIAL_PLAYERS` dans `parseEnv` (design §1), tests dans `tests/lib/env.test.ts`. `"Manu, Gab,Sean"` → `["Manu", "Gab", "Sean"]` (`toEqual`) ; `" , Gab ,, "` → `["Gab"]` ; absente et `""` → `[]` ; `"Gab,gab"` lève une erreur qui contient `INITIAL_PLAYERS`. Mettre à jour les deux `toEqual` existants qui comparent l'`Env` complet. Mutation : comparer les doublons avec la casse fait rougir `"Gab,gab"`.
- [ ] 1.2 TDD : `seedInitialPlayers(db, names)` et `DEV_PLAYERS` dans `src/server/players/seed.ts`, tests dans `tests/server/players/seed.test.ts`. `["Alex", "Sam"]` sur base vide → joueurs exactement `["Alex", "Sam"]` et alias `["ALEX", "SAM"]` ; `[]` sur base vide → aucun joueur ; `["Alex"]` sur une base qui a Gab → joueurs exactement `["Gab"]` ; `DEV_PLAYERS` → `["Manu", "Gab", "Sean"]`. Mutation : ignorer `names` et garder la constante fait rougir le cas Alex/Sam.
- [ ] 1.3 Relayer la liste : `prepareDatabase(db, initialPlayers)` (`src/db/prepare.ts`), `src/instrumentation.ts` passe `getEnv().INITIAL_PLAYERS`, `localSeeders` appelle le seeder avec `DEV_PLAYERS`. Appelants de test sur `DEV_PLAYERS` : `tests/factories.ts`, `tests/server/players/*.test.ts`, `tests/app/api/imports.test.ts`, `tests/e2e/data.ts` (`prepareDatabase(db, DEV_PLAYERS)`). Vérifier : `pnpm typecheck`, `pnpm test`, `pnpm db:reset` puis `/players` montre Gab, Manu et Sean.
- [ ] 1.4 CI : ajouter `INITIAL_PLAYERS=Manu,Gab,Sean` au `.env` du test de fumée compose (`.github/workflows/checks.yml`, étape « Test de fumée compose »), dont le test attend « Gab 72 » et « Manu 88 ». Vérifier en local : `.env` avec `INITIAL_PLAYERS=Manu,Gab,Sean`, `docker compose up --build --wait`, `pnpm e2e:compose` vert ; puis sans la variable, `docker compose down -v && docker compose up --wait`, `/players` vide ; `docker compose down -v`.
- [ ] 1.5 Docs : `.env.example` (`INITIAL_PLAYERS`, facultatif, rôle, absente = aucun joueur, sans effet sur une base qui a des joueurs), section « Configuration » du README, `docs/deployment.md` (variables de `golf-web`, phrase « creates Gab, Manu and Sean » remplacée), commentaire de `src/db/prepare.ts`. Vérifier : `grep -rn "Gab, Manu and Sean\|Manu, Gab" README.md docs/ .env.example` ne trouve plus de mention de création automatique en prod.

## 2. Fuseau du budget IA (spec `scorecard-ai-completion`)

- [ ] 2.1 TDD : `AI_BUDGET_TIME_ZONE` dans `parseEnv` (design §2), tests dans `tests/lib/env.test.ts`. Absente et `""` → `"America/Montreal"` ; `"Europe/Paris"` → `"Europe/Paris"` ; `"Mars/Olympus"` lève une erreur qui contient `AI_BUDGET_TIME_ZONE`. Mutation : valider avec `Intl.supportedValuesOf("timeZone")` fait rougir le défaut `America/Montreal`.
- [ ] 2.2 TDD : fuseau au constructeur d'`AiBudget`, tests dans `tests/ai/budget.test.ts`. Avec `"America/Montreal"`, un `record` à `2026-11-01T02:30:00Z` s'ajoute à `spent("2026-10")` ; avec `"Europe/Paris"`, le même `record` s'ajoute à `spent("2026-11")` et `spent("2026-10")` vaut `0`. Le test existant « 2026-10-31 à 23 h 30 HAE » passe le fuseau Montréal. Mettre à jour les `new AiBudget(...)` de `tests/jobs/*.test.ts`. Mutation : garder `America/Montreal` en dur fait rougir le cas Paris.
- [ ] 2.3 `src/worker.ts` passe `AI_BUDGET_TIME_ZONE` à `AiBudget`. Docs : `.env.example`, README « Configuration », `docs/ai-fallback.md` (« per calendar month in Montreal time » → fuseau configurable, défaut Montréal, effet d'un changement en cours de mois), `docs/deployment.md` (variables de `golf-worker`). Vérifier : `pnpm typecheck`, `pnpm test`.

## 3. Santé du worker (spec `worker-health`)

- [ ] 3.1 TDD : `src/jobs/heartbeat.ts` (design §3), tests dans `tests/jobs/heartbeat.test.ts` sur un fichier d'un dossier temporaire. `writeHeartbeat(file, new Date(1_000_000))` puis `isHeartbeatFresh(file, new Date(1_000_000 + 299_999), 300_000)` → `true` ; à `+ 300_000` → `false` ; fichier absent → `false` ; contenu `"abc"` → `false`. `HEARTBEAT_FILE` → `join(tmpdir(), "golf-worker-heartbeat")`. Mutation : `<=` au lieu de `<` fait rougir le cas `+ 300_000`.
- [ ] 3.2 `src/worker.ts` : `writeHeartbeat(HEARTBEAT_FILE, new Date())` au début de `runOnce`, avant `checkSchema()` ; une erreur d'écriture passe par `onError` sans arrêter la boucle. Vérifier : `pnpm dev`, puis `cat "$(node -p 'require("os").tmpdir()')/golf-worker-heartbeat"` change d'une seconde à l'autre, file vide.
- [ ] 3.3 `docker-compose.yml` : healthcheck du service `worker` (design §4), commentaire qui renvoie à `STALE_AFTER_MS` ; commentaire en retour près de `STALE_AFTER_MS` dans `src/jobs/queue.ts`. Vérifier : `docker compose up --build --wait` rend la main ; `docker compose ps` montre `worker` `healthy` ; `docker compose exec worker node -p 'require("os").tmpdir()'` affiche `/tmp`.
- [ ] 3.4 Worker figé, à la main : `docker kill --signal=STOP "$(docker compose ps -q worker)"` depuis l'hôte (dans le conteneur, PID 1 ignore `SIGSTOP`), puis `docker compose exec worker sh -c 'echo 0 > /tmp/golf-worker-heartbeat'`, attendre 90 s : `docker compose ps` montre `worker` `unhealthy`. `docker compose down -v`.
- [ ] 3.5 Docs : `docs/deployment.md`, section santé du worker : ce que fait le healthcheck compose, la même commande pour Dokploy (`golf-worker`, réglage de health check Swarm, emplacement exact vérifié dans l'interface Dokploy), retrait du healthcheck en cas de retour à une version sans battement (design, Migration Plan). Vérifier : la commande de la doc est identique à celle de `docker-compose.yml`.

## 4. Déconnexion (spec `app-access`)

- [ ] 4.1 Lire `node_modules/next/dist/docs/01-app/02-guides/authentication.md` (suppression du cookie, `redirect` dans une action). Action `logout` dans `src/app/(app)/actions.ts` et composant `LogoutButton` (design §5), rendu en bas de `src/app/(app)/page.tsx`. Test de composant `tests/components/logout-button.test.tsx` : un bouton de nom exact « Se déconnecter » dans un `form`. Mutation : un lien au lieu d'un bouton de formulaire fait rougir le test.
- [ ] 4.2 E2E dans `tests/e2e/access.spec.ts` : connecté, clic sur « Se déconnecter » → URL `/login` et cookie `golf_session` absent du contexte ; `page.goto("/")` → `/login` ; `page.request.post("/api/rounds", ...)` → 401. Second contexte connecté avant la déconnexion : `goto("/")` reste sur l'accueil. Mutation : une action qui redirige sans supprimer le cookie fait rougir le `goto("/")`. Vérifier : `pnpm e2e tests/e2e/access.spec.ts`.
- [ ] 4.3 Téléphone : dans `tests/e2e/mobile.spec.ts` (390 px), sur l'accueil défilée en bas, le bouton « Se déconnecter » est entièrement au-dessus de la barre « Sections » (`boundingBox`) et haut d'au moins 44 px. Vérifier : `pnpm e2e tests/e2e/mobile.spec.ts tests/e2e/layout-width.spec.ts`.
- [ ] 4.4 Docs : `docs/deployment.md` (fermer toutes les sessions = changer `SESSION_SECRET` et redéployer `golf-web` et `golf-worker`), commentaire de `SESSION_SECRET` dans `.env.example`.

## 5. Roadmap et vérification d'ensemble

- [ ] 5.1 `docs/roadmap.md` : retirer les quatre items « Ops and deployment » de Next (et le titre de section s'il reste vide), mettre à jour « Last updated ». Vérifier : `grep -n "Make the first players\|AI budget month\|worker's health\|Add a logout" docs/roadmap.md` ne trouve rien.
- [ ] 5.2 Contrôles locaux : `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm jscpd`, `pnpm e2e`, `openspec validate harden-self-hosting --strict`. Ouvrir la PR (`feat: …`) ; la CI passe, y compris `checks / docker` avec le worker sain sous `--wait`.

## Workflow follow-up

- Après fusion et release : ajouter le health check de `golf-worker` dans Dokploy (design, Migration Plan), puis redéployer.
- Sur le téléphone : vérifier que « Se déconnecter » ramène à `/login` dans l'app installée sur l'écran d'accueil.
- Archiver le change par une PR `chore(openspec): archive harden-self-hosting`.
