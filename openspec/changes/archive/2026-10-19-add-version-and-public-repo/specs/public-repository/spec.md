# Spec Delta

## Purpose

Fixer ce que le dépôt GitHub public offre à un visiteur qui ne connaît pas le groupe : comprendre le projet, le lancer, le réutiliser, contribuer et signaler une faille.

## ADDED Requirements

### Requirement: Licence MIT
Le dépôt SHALL contenir à sa racine un fichier `LICENSE` au texte MIT, au nom de Emmanuel Paul, année 2026, et `package.json` SHALL déclarer `"license": "MIT"`.

#### Scenario: Licence reconnue par GitHub
- **WHEN** un visiteur ouvre la page du dépôt sur GitHub
- **THEN** GitHub affiche la licence « MIT License »

### Requirement: README en anglais
Le `README.md` SHALL être rédigé en anglais et contenir, dans cet ordre : titre et résumé en une phrase, badges, capture d'écran, sections « Features », « Quick start », « Architecture », « Configuration », « Documentation », « Contributing », « Security », « License ». Il SHALL dire que l'interface est en français.

Les badges SHALL être des images shields.io, chacune liée à une page, en trois rangées :
- statut et release, dynamiques : CI de `main`, dernière release, date de la release, commits depuis la dernière release, dernier commit, issues ouvertes, licence, image GHCR ;
- stack technique : Next.js, React, TypeScript, SQLite, Tesseract, Node, pnpm, Docker, avec la version majeure utilisée, chacun lié au site du projet ;
- topics : `golf`, `handicap`, `gspro`, `ocr`, `tesseract`, `nextjs`, `sqlite`, `self-hosted`, chacun lié à `https://github.com/topics/<topic>`.

La section « Quick start » SHALL finir par une sous-section de niveau 3 « Releases and image tags » : PR de release ouverte par release-please à partir des Conventional Commits (`feat` → mineure, `fix` → patch), tag git `vX.Y.Z` et release GitHub, tags de l'image GHCR (`vX.Y.Z`, `latest`, sha du commit), image multi-arch, label OCI `org.opencontainers.image.revision`, vérification d'une instance par `GET /api/version`, avec des liens vers la page des releases, le paquet GHCR, `CHANGELOG.md`, `docs/ci.md` et `docs/deployment.md`.

La section « Documentation » SHALL lier `docs/roadmap.md`.

#### Scenario: Sections du README
- **WHEN** un visiteur lit `README.md`
- **THEN** il trouve les titres de niveau 2 « Features », « Quick start », « Architecture », « Configuration », « Documentation », « Contributing », « Security » et « License », dans cet ordre, et aucun autre

#### Scenario: Badges cliquables
- **WHEN** un visiteur lit le haut de `README.md`, sous le titre et le résumé
- **THEN** il voit, au-dessus des captures d'écran, les trois rangées de badges (statut et release, stack technique, topics), chaque image servie par `img.shields.io` et chaque badge lié à une page

#### Scenario: Releases et tags d'image
- **WHEN** un visiteur cherche quel tag d'image déployer
- **THEN** la sous-section « Releases and image tags », à la fin de « Quick start », explique d'où viennent les versions, donne les tags `vX.Y.Z`, `latest` et sha de l'image GHCR, et dit comment vérifier la version d'une instance avec `GET /api/version`

#### Scenario: Lien vers la feuille de route
- **WHEN** un visiteur lit la section « Documentation »
- **THEN** il trouve un lien vers `docs/roadmap.md`

#### Scenario: Démarrage rapide
- **WHEN** un visiteur suit les commandes de « Quick start » sur une machine avec Node, pnpm et Tesseract
- **THEN** l'app répond sur `http://localhost:3000` avec la page de saisie du code

### Requirement: Documentation détaillée sans perte
Les informations d'exploitation du README actuel (repli IA et données envoyées à Anthropic, coûts et plafond, déploiement Dokploy, sauvegarde, retour arrière, CI et releases, outils de développement) SHALL rester disponibles en anglais sous `docs/`, chaque page liée depuis la section « Documentation » du README.

#### Scenario: Données envoyées à Anthropic
- **WHEN** un visiteur cherche ce que le repli IA envoie hors du serveur
- **THEN** une page de `docs/` liée depuis le README décrit les deux images envoyées, leurs dimensions et l'absence de métadonnées EXIF, comme le README actuel

#### Scenario: Variables d'environnement
- **WHEN** un visiteur lit la section « Configuration »
- **THEN** il trouve chaque variable de `.env.example` et de l'image (`APP_PASSCODE`, `SESSION_SECRET`, `DATA_DIR`, `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD`), obligatoire ou non, avec son rôle

### Requirement: Guides de contribution et de conduite
Le dépôt SHALL contenir `CONTRIBUTING.md` (prérequis, branche depuis `origin/main`, Conventional Commits, TDD, contrôles locaux, OpenSpec pour les changements de comportement, textes d'interface en français), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1) et `SUPPORT.md`.

#### Scenario: Profil communautaire
- **WHEN** un visiteur ouvre Insights → Community standards du dépôt
- **THEN** README, Code of conduct, Contributing, License, Security policy, Issue templates et Pull request template sont cochés

### Requirement: Signalement privé des failles
Le dépôt SHALL contenir `SECURITY.md`, qui demande de signaler une faille par le signalement privé de GitHub et jamais par une issue publique, et dit quelles versions reçoivent les correctifs (la dernière release). Le signalement privé de vulnérabilités SHALL être activé sur le dépôt.

#### Scenario: Signaler une faille
- **WHEN** un visiteur ouvre l'onglet Security du dépôt
- **THEN** il voit la politique de `SECURITY.md` et le bouton « Report a vulnerability »

### Requirement: Modèles d'issue
Le dépôt SHALL proposer des formulaires d'issue « Bug report » et « Feature request », désactiver les issues vierges, et renvoyer les failles vers le signalement privé depuis le choix du modèle.

#### Scenario: Nouvelle issue
- **WHEN** un visiteur clique « New issue »
- **THEN** il choisit entre « Bug report », « Feature request » et un lien « Report a security vulnerability », sans option d'issue vierge

### Requirement: Métadonnées du dépôt
Le dépôt SHALL avoir une description en anglais sans la mention « app privée », et les topics `golf`, `handicap`, `gspro`, `ocr`, `tesseract`, `nextjs`, `sqlite`, `self-hosted`.

#### Scenario: Page du dépôt
- **WHEN** un visiteur ouvre la page du dépôt
- **THEN** la description est en anglais et les huit topics sont affichés
