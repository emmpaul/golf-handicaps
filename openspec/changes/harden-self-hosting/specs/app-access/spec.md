# Spec Delta

## ADDED Requirements

### Requirement: Fermeture de session
La page d'accueil SHALL offrir un bouton « Se déconnecter » qui ferme la session de ce navigateur et affiche la page de saisie du code. Les sessions ouvertes sur d'autres appareils MUST rester valides.

#### Scenario: Déconnexion
- **WHEN** l'utilisateur connecté appuie sur « Se déconnecter » sur la page d'accueil
- **THEN** le système affiche la page de saisie du code, et une ouverture suivante de la page d'accueil redirige vers cette page

#### Scenario: Écriture après déconnexion
- **WHEN** l'utilisateur s'est déconnecté puis le navigateur envoie une requête d'enregistrement de round
- **THEN** le système la rejette avec un statut 401 et n'enregistre rien

#### Scenario: Autre appareil
- **WHEN** l'utilisateur se déconnecte sur son téléphone alors qu'une session est ouverte sur son ordinateur
- **THEN** l'ordinateur affiche toujours la page d'accueil sans redemander le code
