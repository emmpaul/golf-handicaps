# Design

## Context

Le repo est vide, à part le scaffold OpenSpec. Motivation et périmètre : voir `proposal.md`. Comportements attendus : voir `specs/`.

Contraintes fixées par Manu :
- Next.js en TypeScript.
- Une image Docker construite par GitHub Actions et publiée en **public** sur GHCR, déployée sur son instance Dokploy.
- OCR classique, sans IA.
- Tâches lentes dans des workers.
- TDD, jscpd à 0 %, commitlint.

La carte vient du logiciel GSPro, qui tourne sur le simulateur IDRA. Elle s'affiche dans un panneau de taille fixe : bandeau avec le nom du parcours, tableau (HOLE, PAR, INDEX, DISTANCE, puis 1 à 4 lignes de joueur, colonnes 1-9, OUT, 10-18, IN, TOT), puis bande ROUND SETTINGS (tees, date). Photo de référence : `IMG_3064.DNG` (iPhone ProRAW).

**Essai réalisé pendant la planification**, avec Tesseract 5.5 sur la photo de référence :
- OCR brut sur toute la photo : inutilisable. La ligne GAB est perdue et les cases encadrées ou cerclées sont illisibles.
- Case par case, avec inversion des cases sombres, seuillage et effacement des bords connectés : MANU a 20 cases justes sur 21. GAB et PAR perdent surtout des « 4 » isolés. Les totaux à 2 chiffres sont mal cadrés, faute de coordonnées réglées.
- Conclusion : la lecture case par case fonctionne, mais Tesseract seul ne suffit pas pour les chiffres isolés. D'où la décision 5.

## Goals / Non-Goals

**Goals:**
- Lire la carte GSPro de référence sans aucune correction manuelle, et rester utilisable sur une photo moins bonne grâce aux contrôles et à la correction.
- Un seul artefact à déployer (une image), deux processus (web et worker).
- Un domaine handicap pur, testable sans base ni réseau.

**Non-Goals:**
- Autres logiciels ou mises en page de carte (E6 Connect, Trackman…), et autres écrans de GSPro que la carte de fin de round. L'architecture permet de les ajouter plus tard, mais rien n'est prévu ici.
- Détection automatique des coins de la carte (OpenCV). On commence avec un cadrage manuel.
- Rounds de 9 trous, course rating et slope réels, règles WHS avancées (soft cap et hard cap, PCC, rounds de compétition).
- Comptes individuels et droits par joueur.
- Hébergement multi-nœuds : web et worker tournent sur le même hôte Dokploy.

## Decisions

### 1. Next.js (dernière version stable, App Router) en sortie `standalone`, pnpm, TypeScript strict
Les écritures passent par des server actions. L'upload multipart et le service des photos passent par des route handlers. L'UI utilise Tailwind et shadcn/ui, pensée d'abord pour le mobile : on importe au téléphone, à la sortie du simulateur.
*Alternatives* : SvelteKit et FastAPI + HTMX, écartés au profit du choix de Manu.

### 2. SQLite (better-sqlite3, mode WAL) et Drizzle ORM
La base est un fichier `/data/app.db` sur le volume Dokploy. On règle `busy_timeout` à 5000 ms, car deux processus écrivent dans la base. Les migrations drizzle-kit sont versionnées et appliquées par le processus web au démarrage. Le worker attend que la version de schéma attendue soit présente.

Les valeurs de handicap sont stockées en **dixièmes entiers** (17,4 devient 174), ce qui évite les erreurs d'arrondi des flottants.

Tables :
- `players` : nom unique, sans tenir compte de la casse.
- `player_aliases` : alias unique, sans tenir compte de la casse, vers un joueur.
- `rounds` : `course_name`, `tees`, `played_on`, `created_at`, `photo_path` (nullable).
- `round_holes` : pour chaque trou de 1 à 18, `par`, `stroke_index`, `distance`.
- `round_players` : joueur et ordre de la ligne.
- `scores` : round, joueur, trou, coups.
- `player_round_stats` : table **dérivée**, recalculée. Elle contient `gross`, `adjusted`, `differential_t`, `index_before_t`, `index_after_t` et `counts_in_current`.
- `imports` : statut, photo, coins, brouillon JSON, round créé.
- `jobs` : la file de tâches (décision 4).

Les parcours connus ne sont pas une table. On les dérive des rounds : la paire (nom, tees) la plus récente fournit pars, index et distances (spec `rounds`). On évite ainsi une table à synchroniser.
*Alternative* : Postgres, écarté. C'est un service de plus à gérer sur Dokploy, pour un volume de quelques centaines de rounds.

### 3. Domaine handicap pur et recalcul synchrone
Un module `src/domain/` sans aucune dépendance regroupe : score ajusté par trou (`min(coups, par + 4)`), différentiel, table WHS, arrondi au dixième, handicap de jeu, répartition des coups (modes Écart et Complet, handicap négatif).

Après toute écriture de round, le système recalcule `player_round_stats` pour les joueurs concernés, **dans la même transaction**. On rejoue leur historique trié par (`played_on`, `created_at`). Avec moins de 1000 rounds, ça prend quelques millisecondes : pas besoin d'un job. Les index de la spec (provisoire avec 1 ou 2 rounds, table pour 3 à 20) viennent tous de ce module.

### 4. File de jobs dans SQLite, worker dans un processus séparé
La table `jobs` contient : `type`, `payload`, `status` (queued, running, done, failed), `attempts`, `run_after`, `locked_at`, `last_error`.

Fonctionnement du worker :
- Le worker (`node worker.js`, même image que le web) interroge la table toutes les secondes.
- Il réserve un job de façon atomique : `UPDATE … WHERE id = (SELECT … status='queued' AND run_after <= now ORDER BY id LIMIT 1) RETURNING *`.
- Un job resté en `running` plus de 5 minutes est remis en file.
- Après 2 tentatives, le job passe en `failed` (spec « Échec de la lecture »).

Un seul type de job au départ : `ocr-scorecard`. L'UI interroge l'état des imports toutes les 2 secondes tant que l'un d'eux est en attente ou en cours.
*Alternatives* :
- BullMQ + Redis : écarté, c'est un service de plus.
- Worker dans le processus Next (hook `instrumentation`) : écarté. Une lecture lente pèserait sur le serveur web, et Manu a demandé des workers séparés.

### 5. Pipeline OCR

1. **Navigateur** : il décode la photo avec `createImageBitmap`. Safari gère le HEIC, et peut-être le DNG (à vérifier, voir Risques). Il la réencode en JPEG, 3000 px maximum sur le grand côté. L'éditeur de coins utilise des pointer events et envoie des coordonnées normalisées entre 0 et 1. Le navigateur ne fait aucun traitement lourd.
2. **Upload** : le route handler enregistre `/data/uploads/<uuid>.jpg`, crée l'`import` et le job dans la même transaction.
3. **Redressement** : sharp extrait les pixels bruts. Une homographie, calculée à partir des 4 coins (résolution 8×8 en TS pur, testable), fait un échantillonnage bilinéaire vers un rectangle à la proportion du panneau GSPro.
4. **Gabarit de mise en page** : `layouts/gspro.ts` décrit, en coordonnées relatives au panneau redressé, les zones texte (nom du parcours, bande de réglages) et la grille (lignes PAR, INDEX, DISTANCE, 4 lignes de joueur possibles ; 21 colonnes). On le calibre sur `IMG_3064`. Une ligne de joueur dont la case du nom est vide (variance faible) est considérée comme absente.
5. **Préparation des cases** : celle de l'essai. Passage en niveaux de gris. Polarité choisie d'après un anneau de pixels autour du chiffre : cases encadrées sombres et ronds rouges sont inversés. Puis autocontraste, seuillage, effacement des taches connectées au bord (cadres), agrandissement ×3 et marge blanche.
6. **Lecture des chiffres** derrière une interface `CellReader` :
   - `TesseractCellReader` : binaire `tesseract` natif installé dans l'image, `--psm 7`, liste blanche `0-9`, 4 cases en parallèle.
   - `TemplateCellReader` : la police du simulateur est fixe. On découpe chaque chiffre en composantes connexes, puis on compare chaque glyphe normalisé à des modèles de 0 à 9 extraits de la carte de référence (distance de Hamming sur une grille 16×24). C'est la lecture principale des scores. Tesseract sert de repli si l'écart au meilleur modèle dépasse un seuil.
   - Le choix final se fait par test : la carte de référence MUST être lue sans erreur (tâche 6.7).
7. **Texte** : Tesseract `--psm 6` sur le bandeau et la bande de réglages. On extrait les tees avec `TEES:\s*(\w+)` et la date avec `DATE:\s*(\d{1,2})/(\d{1,2})/(\d{4})`, au format mois/jour/année. Les noms des joueurs passent par `--psm 7`, liste blanche A-Z, puis par la correspondance d'alias de la spec `players` (distance de Levenshtein ≤ 1).
8. **Brouillon** : on enregistre le JSON lu avec, pour chaque case, la valeur ou `null`. Les contrôles de cohérence ne sont **pas** stockés : un module partagé client/serveur les recalcule à chaque modification. L'écran de correction et le contrôle serveur avant enregistrement utilisent ainsi la même fonction, sans duplication.

### 6. Accès
- Le code est comparé à `APP_PASSCODE` avec `timingSafeEqual`.
- Le cookie de session est signé en HMAC avec `SESSION_SECRET` : httpOnly, Secure en production seulement (http://localhost en dev), SameSite=Lax, 90 jours.
- Le middleware Next protège tout, sauf `/login` et les assets statiques.
- Limite simple en mémoire : 10 essais par minute et par IP sur `/login`.
- Le web et le worker refusent de démarrer si une variable obligatoire manque.
- Les photos sont servies uniquement par un route handler authentifié, jamais depuis `public/`.

### 7. Image Docker publique et déploiement Dokploy
- Dockerfile multi-étapes sur l'image Node LTS la plus récente en Debian slim, pinnée par tag exact et digest (`node:<x.y.z>-<debian>-slim@sha256:…`) : better-sqlite3 et sharp ont des binaires prêts pour glibc, et `tesseract-ocr` s'installe avec apt. Trois étapes : dépendances, puis build (`next build` en standalone, plus le bundle `worker.js` avec esbuild), puis exécution (utilisateur non root, `/data` en volume).
- Commande par défaut : `node server.js`. Le service worker de Dokploy remplace la commande par `node worker.js`.
- **Image publique** : aucun secret au build. Tout passe par les variables d'environnement au démarrage. Le `.dockerignore` exclut `tests/`, les fixtures photo, `.env*` et `.git`. Les labels OCI pointent vers le repo. La visibilité du package GHCR est réglée sur « public » une fois, à la main, après le premier push. Dokploy tire ensuite l'image sans identifiants.
- **GitHub Actions** :
  - Sur une PR : install, lint, typecheck, tests unitaires, e2e Playwright, jscpd, commitlint sur les commits de la PR, build Docker sans push.
  - Sur `main` : les mêmes contrôles (workflow réutilisable `checks.yml`), puis release-please (`googleapis/release-please-action`, pinnée par SHA). Il tient à jour une PR de release : version dans `package.json`, `CHANGELOG.md` et `.release-please-manifest.json` (type `node`, sémantique avant 1.0 : `feat` → mineure, `fix` → patch). Aucun push d'image sur un simple push sur `main`. Manifeste à 0.0.0 et `initial-version: 0.1.0` dans la config ; la première PR de release propose v0.1.0.
  - À la fusion de la PR de release : release-please crée le tag `vX.Y.Z` et la release GitHub. Seulement quand il signale `release_created`, un job du **même** workflow (les releases créées avec `GITHUB_TOKEN` ne déclenchent pas d'autre workflow) construit l'image multi-arch (`linux/amd64,linux/arm64`, car l'architecture de l'hôte n'est pas fixée) et pousse `ghcr.io/<owner>/golf-handicaps:{vX.Y.Z,latest,sha}`, avec les labels OCI (`org.opencontainers.image.version` = la version de la release). Le build ne tourne qu'après les contrôles au vert.
  - Permissions minimales par job : `contents: write` et `pull-requests: write` pour release-please, `packages: write` pour le job image.
  - `main` protégée (PR obligatoire, contrôles requis, admins inclus) ; release-please utilise le secret `RELEASE_PLEASE_TOKEN` (PAT fine-grained, Contents + Pull requests en écriture) pour que sa PR de release déclenche les contrôles.
  - Déploiement **manuel** dans Dokploy : on choisit le tag (`vX.Y.Z` ou `latest`) et on redéploie les deux services. Aucun webhook, aucun secret Dokploy dans GitHub.
  - Renovate n'est pas concerné : ses PR passent par le workflow PR comme les autres.

### 8. Qualité : TDD, jscpd à 0 %, commitlint
- **TDD** : chaque comportement de production commence par un test rouge qui échoue pour la raison nommée, selon les règles de test de Manu : valeurs attendues écrites à la main, assertions serrées, code réel exécuté.
  - Vitest pour le domaine, l'OCR (avec la vraie photo de référence convertie en JPEG dans `tests/fixtures/`) et la base (SQLite temporaire).
  - Playwright pour les parcours principaux (connexion, import de la photo de référence jusqu'à l'enregistrement, saisie manuelle, coups à donner).
  - Les exemples chiffrés des specs servent de cas de test.
- **jscpd** : `.jscpd.json` avec `threshold: 0` sur `src/` et `tests/`. Sont ignorés : le code généré (migrations Drizzle, `src/components/ui/` produit par shadcn). Échec en CI à la moindre duplication. Hook `pre-push` en local.
- **commitlint** : `@commitlint/config-conventional`, hook `commit-msg` via lefthook, et contrôle en CI. Aucun trailer `Co-Authored-By` (règle globale de Manu).

### 9. Confort de développement (DX)
- **Biome** à la place d'ESLint + Prettier : un seul outil, rapide, avec un `biome.json` strict.
- **lefthook** : `pre-commit` (Biome sur les fichiers indexés, typecheck), `commit-msg` (commitlint), `pre-push` (tests unitaires et jscpd). Plus rapide que husky + lint-staged et en un seul fichier.
- `pnpm dev` lance le web et le worker en parallèle (`concurrently`, le worker via `tsx watch`). `pnpm db:reset` recrée une base locale avec les 3 joueurs et le round de référence.
- `docker compose up` (web + worker + volume) reproduit la prod en local. La CI l'utilise aussi pour un test de fumée sur l'image.
- Node fixé à la version exacte par `.nvmrc`, pnpm par le champ `packageManager` avec son hash (corepack).
- `.env.example` documenté. Le démarrage valide les variables d'environnement avec zod.
- `.vscode/extensions.json` (Biome, Vitest, Playwright) et `settings.json` (formatage à l'enregistrement).
- Renovate en mode groupé hebdomadaire, qui garde les pins (décision 10). Template de PR. Script `pnpm ocr:debug <photo> <coins>` qui écrit dans un dossier temporaire la planche des cases préparées et la valeur lue. C'est l'outil utilisé pendant l'essai, et c'est ce qui permet de régler le gabarit.
- README court : dev local, variables, déploiement Dokploy pas à pas.

### 10. Dernières versions, toutes pinnées
Au moment du scaffold, chaque dépendance s'installe dans sa **dernière version stable**, vérifiée avec `pnpm view <paquet> version`. Pas de version tirée de mémoire, pas de pré-version.

Chaque version est ensuite pinnée exactement, sans `^` ni `~` :
- `.npmrc` contient `save-exact=true`. Le `pnpm-lock.yaml` est commité et la CI installe en `--frozen-lockfile`.
- Le script `pnpm check:pins`, lancé en CI, échoue si une version de `package.json` (dépendances, devDependencies, `packageManager`) n'est pas exacte.
- Les images Docker de base sont pinnées par tag exact et digest `sha256`.
- Les GitHub Actions sont pinnées par SHA de commit complet, avec la version en commentaire (`uses: actions/checkout@<sha> # vX.Y.Z`).
- Les paquets apt de l'image (`tesseract-ocr`) suivent la version figée de la release Debian du digest. La version installée est affichée au build.

Renovate tient tout à jour sans casser les pins : `rangeStrategy: "pin"`, `pinDigests: true`, et le gestionnaire `github-actions` en mode digest.

*Alternative* : des plages `^` avec seulement le lockfile, écartées. Manu veut des versions explicites et lisibles dans `package.json`.

## Risks / Trade-offs

- [Une autre photo, avec un reflet, un moiré ou un fort biais, est mal lue] → contrôles de cohérence par les sommes, surlignage, correction obligatoire avant enregistrement, saisie manuelle toujours possible.
- [Le simulateur change sa mise en page] → le gabarit est isolé dans `layouts/gspro.ts`. Le script `ocr:debug` permet de le recalibrer. Les contrôles de cohérence repèrent tout de suite un décalage.
- [Les modèles de chiffres viennent d'une seule photo] → on en ajoute à partir des corrections manuelles : le brouillon garde chaque case recadrée. Ce n'est pas prévu dans ce change, juste rendu possible.
- [Safari ou le navigateur ne décode pas le DNG ProRAW] → message « exporte-la en JPEG » (spec). On vérifie avec `IMG_3064.DNG` dans Safari iOS et macOS pendant les tâches. Une photo d'écran se prend normalement en HEIC ou JPEG.
- [Deux processus écrivent dans le même fichier SQLite] → mode WAL, `busy_timeout`, transactions courtes. Le worker n'écrit que dans `jobs` et `imports`. Les deux services doivent tourner sur le même hôte : c'est noté dans le README.
- [Handicap « maison »] → il n'est pas comparable à un index officiel, puisque le différentiel se calcule sur le par et pas sur le course rating. Ça se lit en interne au groupe, et l'app le présente comme « index simulateur ».
- [L'image publique révèle le code] → c'est accepté. Aucun secret ni donnée dans l'image, et l'app reste fermée par le code d'accès.
- [jscpd à 0 % pénalise les tests répétitifs] → on factorise les fabriques de données de test (`tests/factories.ts`) et on utilise `it.each` pour les tables de cas.

## Migration Plan

1. Dans les réglages du repo (Settings → Actions → General), cocher « Allow GitHub Actions to create and approve pull requests », sinon release-please ne peut pas ouvrir sa PR.
   Une fois aussi : `main` protégée (PR obligatoire, contrôles requis, admins inclus) ; release-please utilise le secret `RELEASE_PLEASE_TOKEN` (PAT fine-grained, Contents + Pull requests en écriture) pour que sa PR de release déclenche les contrôles.
2. Premier push sur `main` (un commit `feat:` ; manifeste à 0.0.0 et `initial-version: 0.1.0` dans la config) : release-please ouvre la PR de release v0.1.0. La fusionner publie l'image `:v0.1.0` et `:latest`. Passer le package GHCR en public.
3. Dans Dokploy, créer le service `golf-web` (image `ghcr.io/<owner>/golf-handicaps:latest`, port 3000, volume `golf-data:/data`, variables `APP_PASSCODE`, `SESSION_SECRET`, domaine en HTTPS).
4. Créer le service `golf-worker` : même image, même volume, commande `node worker.js`, mêmes variables, sans port.
5. Déployer : à chaque release, choisir le tag (`vX.Y.Z` ou `latest`) dans Dokploy et redéployer les deux services, à la main. Aucun secret de déploiement dans GitHub.
6. Retour arrière : redéployer le tag `vX.Y.Z` précédent dans Dokploy, sur les deux services. Les migrations sont seulement additives dans ce change. Sauvegarde : copier `/data` (base et photos).
