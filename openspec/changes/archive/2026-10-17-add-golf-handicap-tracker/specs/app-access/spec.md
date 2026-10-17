# Spec Delta

## Purpose

Réserver l'app au groupe d'amis avec un code d'accès partagé unique, sans comptes individuels.

## ADDED Requirements

### Requirement: Accès protégé par code partagé
Le système MUST refuser l'accès à toute page et à toute action de lecture ou d'écriture tant que le visiteur n'a pas saisi le code d'accès configuré sur le serveur. Seule la page de saisie du code reste accessible sans session.

#### Scenario: Visiteur sans session
- **WHEN** un visiteur sans session ouvre la page d'accueil
- **THEN** le système le redirige vers la page de saisie du code

#### Scenario: Écriture sans session
- **WHEN** une requête d'enregistrement de round arrive sans session valide
- **THEN** le système la rejette avec un statut 401 et n'enregistre rien

### Requirement: Ouverture de session
Quand le code saisi est exact, le système SHALL ouvrir une session dans le navigateur, valable 90 jours. Quand le code est faux, le système SHALL afficher « Code incorrect » et n'ouvrir aucune session.

#### Scenario: Code correct
- **WHEN** le visiteur saisit le code configuré
- **THEN** le système ouvre une session et affiche la page d'accueil

#### Scenario: Code incorrect
- **WHEN** le visiteur saisit un code différent du code configuré
- **THEN** le système affiche « Code incorrect » et le visiteur reste sur la page de saisie

### Requirement: Démarrage sans code configuré
Le système MUST refuser de démarrer si aucun code d'accès n'est configuré, au lieu de laisser l'app ouverte à tous.

#### Scenario: Variable absente
- **WHEN** le serveur démarre sans code d'accès configuré
- **THEN** le démarrage échoue avec un message qui nomme la variable manquante
