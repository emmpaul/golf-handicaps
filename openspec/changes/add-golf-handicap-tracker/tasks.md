# Tasks

Règle pour tout le change : TDD. Chaque tâche qui touche du code de production commence par un test rouge. Ce test échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après la spec. Ensuite seulement vient le code qui le fait passer. `pnpm jscpd` reste à 0 % et chaque commit passe commitlint.

## 1. Scaffold et outillage

- [x] 1.1 Initialiser Next.js dans sa dernière version stable (App Router, TS strict, Tailwind, `output: "standalone"`) avec pnpm. Ajouter `.npmrc` avec `save-exact=true`, `.nvmrc` à la version exacte de la dernière LTS de Node, et `packageManager` avec hash. Vérifier : `pnpm build` passe et `package.json` ne contient aucun `^` ni `~`.
- [x] 1.2 Pour chaque dépendance ajoutée dans ce change (ici et dans les groupes suivants), relever la dernière version stable avec `pnpm view <paquet> version` et l'installer exactement à cette version. Écrire `pnpm check:pins` : il échoue sur toute version non exacte de `package.json`. Vérifier : la commande sort en code 0, et échoue si on remet temporairement un `^` sur une dépendance.
- [x] 1.3 Installer Biome (`biome.json` strict) et ajouter les scripts `lint`, `format` et `typecheck`. Vérifier : `pnpm lint && pnpm typecheck` passent.
- [x] 1.4 Configurer Vitest (unitaire) et Playwright (e2e, Chromium et WebKit mobile) avec un test d'exemple pour chacun. Vérifier : `pnpm test` et `pnpm e2e` passent.
- [x] 1.5 Configurer jscpd (`.jscpd.json`, `threshold: 0`, `src/` et `tests/`, ignorer les migrations et `src/components/ui/`). Vérifier : `pnpm jscpd` sort en code 0. Dupliquer temporairement un bloc de 60 tokens : la commande doit échouer.
- [x] 1.6 Configurer commitlint (`config-conventional`) et lefthook (`pre-commit` : Biome + typecheck, `commit-msg` : commitlint, `pre-push` : tests + jscpd). Vérifier : `git commit -m "bad"` est refusé, `git commit -m "chore: test"` passe.
- [x] 1.7 Ajouter `.vscode/extensions.json` et `settings.json`, `.env.example`, `renovate.json` (`rangeStrategy: "pin"`, `pinDigests: true`, groupé hebdomadaire) et le template de PR. Vérifier : les fichiers sont présents et `pnpm lint` passe.
- [x] 1.8 Convertir `IMG_3064.DNG` en `tests/fixtures/scorecards/gspro-img3064.jpg`, plus `gspro-img3064.corners.json` (coins du panneau mesurés à la main). Vérifier : le JPEG s'ouvre et les 4 coins tombent sur le panneau dans une capture annotée.

## 2. Configuration et accès (spec `app-access`)

- [x] 2.1 TDD : valider les variables d'environnement avec zod (`APP_PASSCODE`, `SESSION_SECRET`, `DATA_DIR`). Le test rouge vérifie que l'absence de `APP_PASSCODE` lève une erreur dont le message contient `APP_PASSCODE`.
- [x] 2.2 TDD : signer et vérifier le cookie de session (HMAC, expiration à 90 jours). Les tests couvrent un cookie altéré (refusé), un cookie expiré (refusé) et un cookie valide.
- [x] 2.3 TDD : action de connexion. Avec le bon code, la session est créée. Avec un mauvais code, le message est exactement « Code incorrect ». Au 11e essai dans la minute, la requête est refusée.
- [x] 2.4 TDD : middleware de protection. Test e2e : sans session, `/` redirige vers `/login`. Sans session, l'écriture d'un round renvoie 401.

## 3. Base de données et joueurs (spec `players`)

- [x] 3.1 Écrire le schéma Drizzle (toutes les tables du design, décision 2) et la première migration. Ajouter `pnpm db:migrate` et `pnpm db:reset`. Vérifier : les migrations s'appliquent sur une base vide temporaire, dans un test Vitest.
- [x] 3.2 TDD : seed initial. Sur une base vide, on obtient exactement `["Gab", "Manu", "Sean"]` avec les alias `GAB`, `MANU` et `SEAN`. Sur une base non vide, rien ne change.
- [x] 3.3 TDD : ajout et renommage d'un joueur. Ajouter « gab » quand « Gab » existe est refusé avec le message « Ce joueur existe déjà ».
- [x] 3.4 TDD : correspondance d'alias. `GAB` donne Gab (exact), `MANV` donne Manu (distance 1), `JULIEN` ne donne rien. Puis apprentissage d'un alias : `SEANP` donne Sean après association manuelle.

## 4. Domaine handicap (spec `handicap-index`, `match-strokes`)

- [x] 4.1 TDD : score ajusté. Un 10 sur un par 4 compte 8. Manu sur la carte de référence vaut 88 et Gab 72.
- [x] 4.2 TDD : différentiel en dixièmes. Sur la carte de référence, Gab obtient 10 et Manu 170.
- [x] 4.3 TDD : table WHS avec `it.each` sur les 20 tailles d'historique. Cas des specs : [170, 120, 200] donne 100. [170, 120, 200, 150, 140, 180] donne 120. [170, 120] donne 145, marqué provisoire. 21 rounds : le plus ancien est exclu. Arrondi : 13,25 donne 133. Plafond : 610 donne 540.
- [x] 4.4 TDD : handicap de jeu. 174 donne 17, 10 donne 1, 125 donne 13.
- [x] 4.5 TDD : répartition des coups avec les index Bethpage Red (8,16,18,2,4,10,6,14,12,9,11,7,3,17,1,5,13,15). 16 coups : tous les trous sauf 3 et 14. 1 coup : trou 15. 20 coups : 2 coups sur les trous 15 et 4. −2 : rend un coup sur les trous 3 et 14.
- [x] 4.6 TDD : modes Écart et Complet. Pour Gab 10 et Manu 174 : Écart donne [0, 16], Complet donne [1, 17].

## 5. Rounds et recalcul (spec `rounds`)

- [x] 5.1 TDD : contrôles de cohérence d'une carte, dans un module partagé client/serveur. Somme aller fausse : message exact « Somme aller 36 ≠ OUT 38 ». Index en double : les deux cases surlignées. Par hors de 3 à 5, score hors de 1 à 15, case vide, ligne sans joueur, joueur en double : chacun produit son erreur. Le nombre de problèmes est exact.
- [x] 5.2 TDD : enregistrement d'un round, refusé côté serveur si le contrôle 5.1 échoue. Écriture des trous, joueurs et scores, puis recalcul de `player_round_stats` dans la même transaction. Le round de référence donne 72 et 88 bruts, différentiels 10 et 170.
- [x] 5.3 TDD : recalcul de l'historique. Un round ajouté avant les autres change `index_after_t` des rounds suivants. `counts_in_current` marque les 2 meilleurs sur 6 rounds.
- [x] 5.4 TDD : classement net. Gab (index 10 avant le round) et Manu (174) avec 72 et 88 bruts sont tous deux à 71 net, premiers ex æquo. Un joueur sans index a un net `null` et n'est pas classé.
- [x] 5.5 TDD : correction d'un round (Manu trou 1 de 7 à 6, brut 87, index recalculé) et suppression (round retiré, index recalculés).
- [x] 5.6 TDD : parcours connus et détection de doublon. Red et Blue sont séparés. Les valeurs de référence viennent du round le plus récent. Un même parcours, avec les mêmes tees, la même date et les mêmes bruts, est détecté comme doublon.

## 6. OCR (spec `scorecard-import`, lecture)

- [x] 6.1 TDD : homographie. 4 coins connus envoient des points de test vers des coordonnées attendues, écrites à la main, à ±0,5 px près.
- [x] 6.2 TDD : redressement avec sharp de la photo de référence selon ses coins. L'image sortie a la taille du gabarit GSPro. Ajouter le script `pnpm ocr:debug` qui écrit la planche des cases dans un dossier temporaire.
- [x] 6.3 Calibrer `layouts/gspro.ts` sur la photo de référence avec `ocr:debug`. Vérifier : sur la planche, chaque case contient un seul nombre centré, et les lignes vides 3 et 4 sont détectées comme absentes.
- [x] 6.4 TDD : préparation d'une case. Une case encadrée sombre et une case à rond rouge sont inversées et sans cadre. Le test compte les pixels noirs touchant le bord : 0 attendu.
- [x] 6.5 TDD : `TemplateCellReader`, avec modèles 0 à 9 extraits de la carte de référence. Lecture de la ligne MANU = 7,5,3,7,6,5,5,3,5,46,3,6,5,7,4,5,4,3,5,42,88.
- [x] 6.6 TDD : `TesseractCellReader` en repli (binaire natif). La case « 16 » de la ligne INDEX se lit 16.
- [x] 6.7 TDD : lecture complète de la photo de référence. Tout le brouillon doit être exactement égal aux valeurs écrites à la main : parcours `BETHPAGE BLACK`, tees `Red`, date `2026-10-17`, noms `GAB` et `MANU`, pars, index, distances, 18 scores et totaux par joueur. Aucune case `null`.
- [x] 6.8 TDD : lecture de la date au format mois/jour/année. `03/04/2026` donne `2026-03-04`. Une date absente donne `null`, et l'UI la remplace par la date du jour.

## 7. File de jobs et worker (spec `scorecard-import`, lecture en tâche de fond)

- [x] 7.1 TDD : réservation atomique d'un job. Deux réservations concurrentes sur une base à 1 job : une seule réussit. Un job en `running` depuis plus de 5 minutes est remis en file.
- [x] 7.2 TDD : nouvelles tentatives. Un gestionnaire qui lève 2 fois laisse le job en `failed` et l'import en « Échec », avec `last_error` renseigné.
- [x] 7.3 TDD : gestionnaire `ocr-scorecard`. Pour la photo de référence, l'import passe à « Prêt à vérifier » avec le brouillon de la tâche 6.7.
- [x] 7.4 Écrire le point d'entrée `worker.ts` (boucle d'interrogation, arrêt propre sur SIGTERM, validation de l'environnement) et l'intégrer au bundle esbuild. Ajouter `pnpm dev`, qui lance le web et le worker. Vérifier : `pnpm dev`, puis un import de la photo de référence arrive à « Prêt à vérifier ».

## 8. Interface

- [x] 8.1 TDD (e2e) : envoi d'une photo. Le JPEG s'affiche. Un fichier illisible affiche « Format de photo non lisible, exporte-la en JPEG » et propose la saisie manuelle.
- [x] 8.2 TDD (e2e) : éditeur de coins (poignées au doigt et à la souris, aperçu redressé) et mise en file. Envoyer 3 photos à la suite donne 3 imports listés avec leur état.
- [x] 8.3 TDD (e2e) : écran de correction pour la photo de référence. Il est pré-rempli, la photo est visible. Mettre une valeur fausse fait apparaître le surlignage et le compteur « 1 problème à corriger ». La corriger le fait disparaître. On peut ajouter une ligne pour Sean. Enregistrer fait apparaître le round dans la liste.
- [x] 8.4 TDD (e2e) : saisie entièrement manuelle. En choisissant « Bethpage Black / Red », les pars, index et distances se pré-remplissent.
- [x] 8.5 TDD (e2e) : avertissement de doublon quand on réimporte la photo de référence, avec un lien vers le round existant.
- [x] 8.6 TDD (e2e) : liste des rounds (du plus récent au plus ancien, gagnant net) et détail (classement net, photo servie par une route authentifiée). Correction, puis suppression avec confirmation et annulation.
- [x] 8.7 TDD (e2e) : page joueurs (ajout, renommage, alias). Page handicap : index et mention « provisoire », courbe par joueur (un point par round), liste des différentiels avec ceux qui comptent marqués.
- [x] 8.8 TDD (e2e) : page « coups à donner ». Sean, sans index, est grisé. Pour Gab, Manu et Bethpage Red : Écart donne 0 et 16, Complet donne 1 et 17. Les trous où tombent les coups sont listés.
- [x] 8.9 Vérifier le rendu mobile (WebKit iPhone dans Playwright) sur les pages d'import et de correction : pas de défilement horizontal, poignées utilisables.

## 9. Conteneur, CI/CD et documentation

- [x] 9.1 Écrire le Dockerfile multi-étapes (dernière image Node LTS Debian slim pinnée par tag exact et digest `sha256`, `tesseract-ocr` installé avec apt et version affichée au build, utilisateur non root, `/data` en volume, commandes `server.js` et `worker.js`) et un `.dockerignore` qui exclut `tests/`, `.env*` et `.git`. Vérifier : `docker build` passe, `docker run --rm <img> ls /app` ne montre aucune fixture, et `docker history` ne contient aucun secret.
- [x] 9.2 Écrire le `docker-compose.yml` local (web + worker + volume). Vérifier : `docker compose up`, puis connexion et import de la photo de référence de bout en bout.
- [x] 9.3 Workflow GitHub Actions sur les PR, avec chaque action pinnée par SHA complet et sa version en commentaire : `pnpm install --frozen-lockfile`, `check:pins`, lint, typecheck, test, e2e, jscpd, commitlint sur la plage de la PR, build Docker sans push, test de fumée compose. Vérifier : une PR de test passe au vert, et un commit `bad message` la fait échouer.
- [x] 9.4 Workflow sur `main` : contrôles (`checks.yml`), puis release-please (action pinnée par SHA complet). Seulement quand release-please signale `release_created`, job du même workflow, après les contrôles : build multi-arch amd64/arm64 et push `ghcr.io/<owner>/golf-handicaps:{vX.Y.Z,latest,sha}` avec labels OCI (`org.opencontainers.image.version` = version de la release). Aucun push d'image sur un simple push sur `main`, aucun webhook Dokploy. Manifeste à 0.0.0 et `initial-version: 0.1.0` dans la config ; la première PR de release propose v0.1.0. Vérifier : la fusion de la PR de release publie `:v0.1.0`, qui se tire sans identifiants (`docker logout ghcr.io && docker pull ghcr.io/<owner>/golf-handicaps:v0.1.0`).
- [x] 9.5 README : dev local (`pnpm dev`, `db:reset`, `ocr:debug`), variables d'environnement, déploiement Dokploy pas à pas (2 services, même hôte, même volume, sauvegarde de `/data`, retour arrière par tag `vX.Y.Z`). Vérifier : les commandes du README fonctionnent telles qu'écrites sur un clone neuf.
- [x] 9.6 Configurer release-please : `release-please-config.json` (type `node`, `bump-minor-pre-major`, `initial-version: 0.1.0`, `CHANGELOG.md`) et `.release-please-manifest.json` (`".": "0.0.0"`, aligné sur `package.json`) ; la première PR de release propose v0.1.0. Le message `chore(main): release X.Y.Z` passe commitlint. Vérifier : la config release-please est valide et le workflow `main` passe actionlint.

## 10. Vérifications d'intégration

- [ ] 10.1 Ouvrir `IMG_3064.DNG` depuis Safari iOS et macOS dans l'app déployée. Noter si le DNG se décode, ou si le message JPEG apparaît, et le consigner dans le README.
- [ ] 10.2 Déployer sur Dokploy (web + worker), importer une vraie nouvelle photo de round à 3 joueurs, la corriger si besoin et l'enregistrer. Vérifier les index et les coups à donner affichés.

## Workflow follow-up

- Cocher « Allow GitHub Actions to create and approve pull requests » dans les réglages Actions du repo, avant le premier push sur `main`.
- Passer le package GHCR en public après le premier push d'image (fusion de la première PR de release).
- Archiver le change (`/opsx:archive`) une fois la revue faite et le déploiement validé.
