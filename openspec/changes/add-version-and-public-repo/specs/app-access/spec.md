# Spec Delta

## MODIFIED Requirements

### Requirement: Accès protégé par code partagé
Le système MUST refuser l'accès à toute page et à toute action de lecture ou d'écriture tant que le visiteur n'a pas saisi le code d'accès configuré sur le serveur. Seules la page de saisie du code, les fichiers d'installation de l'app (manifest et icônes) et la route de version, qui ne contiennent aucune donnée du groupe, restent accessibles sans session.

#### Scenario: Visiteur sans session
- **WHEN** un visiteur sans session ouvre la page d'accueil
- **THEN** le système le redirige vers la page de saisie du code

#### Scenario: Écriture sans session
- **WHEN** une requête d'enregistrement de round arrive sans session valide
- **THEN** le système la rejette avec un statut 401 et n'enregistre rien

#### Scenario: Fichiers d'installation sans session
- **WHEN** un visiteur sans session demande le manifest ou l'icône d'écran d'accueil
- **THEN** le système les sert avec un statut 200, sans redirection vers la page de saisie du code

#### Scenario: Page proche d'un fichier d'installation
- **WHEN** un visiteur sans session demande `/manifest.webmanifest/x` ou `/icon-admin`
- **THEN** le système le redirige vers la page de saisie du code

#### Scenario: Route de version sans session
- **WHEN** un client sans session demande `GET /api/version`
- **THEN** le système la sert avec un statut 200, sans 401

#### Scenario: Route proche de la route de version
- **WHEN** un client sans session demande `GET /api/version/x` ou `GET /api/versions`
- **THEN** le système répond 401
