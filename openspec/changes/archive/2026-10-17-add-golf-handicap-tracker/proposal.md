# Proposal

## Why

Manu, Gab et Sean jouent ensemble sur simulateur sans avoir le même niveau. Ils n'ont pas de handicap à jour pour jouer en net. Après chaque round, ils prennent une photo de la carte affichée à l'écran. Aujourd'hui, ces photos ne servent à rien. Une mini web app peut lire ces photos, garder l'historique des scores et recalculer le handicap de chacun après chaque partie.

## What Changes

- Nouvelle web app privée, accessible avec un code d'accès partagé par le groupe.
- Gestion des joueurs (Manu, Gab, Sean au départ, d'autres ensuite), avec des alias pour relier les noms lus sur la carte (« MANU », « GAB ») au bon joueur.
- Import d'une photo de carte de score du simulateur (mise en page GSPro, simulateur IDRA, comme sur `IMG_3064`). La lecture se fait par OCR classique, sans IA : Tesseract tourne sur le serveur, dans un worker de tâches de fond. L'utilisateur place les 4 coins du panneau de la carte sur la photo. Les totaux OUT/IN/TOT servent à vérifier la lecture. Un écran de correction s'affiche obligatoirement avant d'enregistrer. On peut envoyer plusieurs photos à la suite, et un round peut aussi être saisi entièrement à la main.
- Enregistrement des rounds : parcours, tees, date, et pour chaque trou le par, l'index et la distance, avec le score de chaque joueur. On peut consulter, corriger et supprimer un round.
- Calcul d'un handicap inspiré du WHS et adapté au simulateur. Chaque trou est plafonné à par + 4 (quadruple bogey). Le différentiel vaut le score ajusté moins le par. L'index est la moyenne des meilleurs différentiels parmi les 20 derniers rounds, selon la table WHS.
- Classement net de chaque round (brut, handicap de jeu, net, gagnant).
- Historique : courbe du handicap de chaque joueur dans le temps.
- Coups à donner avant une partie : on choisit les joueurs et un parcours déjà connu. L'app affiche les coups reçus par chaque joueur et les trous où ils tombent, selon l'index de chaque trou.
- Déploiement : image Docker construite par GitHub Actions, publiée sur GHCR et déployée sur l'instance Dokploy de Manu. Les données SQLite et les photos sont stockées sur un volume.

## Capabilities

### New Capabilities

- `app-access` : accès à l'app avec un code partagé et une session dans le navigateur.
- `players` : liste des joueurs du groupe et alias utilisés pour reconnaître les noms sur les cartes.
- `scorecard-import` : passage d'une photo de carte à un round validé (cadrage, OCR, contrôles de cohérence, correction manuelle, détection de doublon).
- `rounds` : stockage, consultation, correction et suppression des rounds, et classement net de chaque round.
- `handicap-index` : calcul des différentiels et de l'index de chaque joueur, avec son historique.
- `match-strokes` : calcul des coups reçus et de leur répartition par trou pour une partie à venir.

### Modified Capabilities

Aucune, le projet ne contient encore aucune spec.

## Impact

- Nouveau code : app Next.js (TypeScript) complète, repo vide aujourd'hui (seulement le scaffold OpenSpec).
- Dépendances : Next.js, Drizzle ORM, better-sqlite3, sharp (redressement et préparation des cases), Tesseract natif dans l'image Docker, une librairie de graphiques, Vitest et Playwright, jscpd, commitlint.
- Infrastructure : une image Docker avec deux commandes (app web et worker de jobs). Workflow GitHub Actions : lint, tests, jscpd à 0 %, commitlint, puis release-please (PR de release, `CHANGELOG.md`, tags `vX.Y.Z`). À chaque release seulement : build multi-arch et push sur `ghcr.io` (`vX.Y.Z`, `latest`, `sha`). Déploiement manuel dans Dokploy en choisissant le tag. Deux services Dokploy partagent le volume persistant `/data`. Variables d'environnement `APP_PASSCODE` et `SESSION_SECRET`.
- Façon de travailler : TDD pour tout le code de production, aucune duplication tolérée (jscpd 0 %), messages de commit au format Conventional Commits vérifiés par commitlint.
- Aucun service externe payant : pas de clé d'API d'IA.
