# app-version Specification

## Purpose
Dire quelle version de l'app tourne, à une machine par une route de version et à une personne par une ligne discrète dans l'interface, pour vérifier qu'un déploiement est en ligne.

## Requirements

### Requirement: Route de version
Le système SHALL répondre à `GET /api/version` par un statut 200 et un objet JSON `{ "version": <chaîne>, "commit": <chaîne ou null> }`, avec l'en-tête `Cache-Control: no-store`. `version` est la version publiée de l'app, sans le préfixe `v`. `commit` est le sha complet (40 caractères hexadécimaux) du commit construit, ou `null` quand le build ne le connaît pas. La réponse ne lit pas la base de données.

#### Scenario: Image construite par la CI
- **WHEN** l'app est construite à la version 0.6.0 depuis le commit `4794e1b0c0ffee00000000000000000000000000` et qu'un client demande `GET /api/version`
- **THEN** le système répond 200 avec `{ "version": "0.6.0", "commit": "4794e1b0c0ffee00000000000000000000000000" }` et `Cache-Control: no-store`

#### Scenario: Build sans commit connu
- **WHEN** l'app tourne à la version 0.6.0 sans commit connu au build et qu'un client demande `GET /api/version`
- **THEN** le système répond 200 avec `{ "version": "0.6.0", "commit": null }`

### Requirement: Route de version sans session
La route de version SHALL rester lisible sans session, en `GET` et `HEAD` seulement. Elle ne donne aucune donnée du groupe.

#### Scenario: Visiteur sans session
- **WHEN** un client sans cookie de session demande `GET /api/version`
- **THEN** le système répond 200 avec la version, sans redirection ni 401

#### Scenario: Écriture sur la route de version
- **WHEN** un client sans session envoie `POST /api/version`
- **THEN** le système répond 401

### Requirement: Version affichée dans l'interface
Le système SHALL afficher en bas de chaque page de l'app et de la page de saisie du code une ligne discrète « v<version> · <7 premiers caractères du commit> », liée à la page de la release GitHub `v<version>` du dépôt. Sans commit connu, la ligne affiche « v<version> » seul. Sur téléphone, la ligne reste visible au-dessus de la barre d'onglets.

#### Scenario: Pied de page avec commit
- **WHEN** l'app construite à la version 0.6.0 depuis le commit `4794e1b0c0ffee00000000000000000000000000` affiche la page d'accueil
- **THEN** le bas de la page montre « v0.6.0 · 4794e1b », lien vers `https://github.com/emmpaul/golf-handicaps/releases/tag/v0.6.0`

#### Scenario: Pied de page sans commit
- **WHEN** l'app à la version 0.6.0 sans commit connu affiche la page de saisie du code
- **THEN** le bas de la page montre « v0.6.0 », lien vers `https://github.com/emmpaul/golf-handicaps/releases/tag/v0.6.0`

#### Scenario: Pied de page au téléphone
- **WHEN** la page des rounds s'affiche à 390 px de large et défile jusqu'en bas
- **THEN** la ligne de version est entièrement visible, au-dessus de la barre d'onglets

### Requirement: Commit inscrit dans l'image publiée
Chaque image Docker construite par la CI SHALL connaître le sha du commit qu'elle construit, et l'image publiée SHALL porter ce sha dans le label OCI `org.opencontainers.image.revision`.

#### Scenario: Image du test de fumée
- **WHEN** la CI construit l'image d'un commit et lance le test de fumée compose
- **THEN** `GET /api/version` sur le service web renvoie `commit` égal au sha de ce commit

#### Scenario: Image publiée
- **WHEN** une release publie l'image `ghcr.io/<owner>/golf-handicaps:vX.Y.Z`
- **THEN** son label `org.opencontainers.image.revision` vaut le sha du commit de la release
