# Spec Delta

## Purpose

Montrer à l'utilisateur, de la même façon partout dans l'app, qu'une action est en cours et qu'il doit attendre, sans gêner la saisie ni les personnes sensibles au mouvement.

## ADDED Requirements

### Requirement: Indicateur d'attente
Pendant toute attente déclenchée par l'utilisateur ou suivie à l'écran, le système SHALL afficher un indicateur composé d'un motif animé et d'un texte court qui dit ce qui se passe et finit par « … ». Le texte MUST être annoncé aux lecteurs d'écran sans interrompre la saisie ; le motif animé MUST être ignoré par eux. L'indicateur SHALL disparaître dès la fin de l'attente.

#### Scenario: Envoi d'une photo cadrée
- **WHEN** l'utilisateur clique sur « Lancer la lecture » et que l'envoi au serveur n'est pas terminé
- **THEN** l'écran affiche « Envoi de la photo… » avec le motif animé, et ce texte est annoncé une fois par le lecteur d'écran

#### Scenario: Fin de l'attente
- **WHEN** l'envoi de la photo se termine
- **THEN** l'indicateur disparaît et le message « Lecture en file d'attente. Tu peux envoyer la photo suivante. » s'affiche

### Requirement: Mouvement réduit
Quand le système d'exploitation ou le navigateur demande de réduire les animations, le motif de l'indicateur MUST rester immobile. Le texte de l'indicateur MUST rester affiché et annoncé.

#### Scenario: Réduire les animations activé
- **WHEN** l'option « réduire les animations » est active et que l'utilisateur lance l'enregistrement d'un round
- **THEN** l'écran affiche « Enregistrement du round… » avec un motif immobile

### Requirement: Attentes de l'import d'une photo
Le système SHALL afficher l'indicateur d'attente pendant la préparation de la photo choisie (« Préparation de la photo… »), pendant le calcul de l'aperçu redressé (« Redressement de la photo… ») et pendant l'envoi d'une photo cadrée ou d'un recadrage (« Envoi de la photo… »).

#### Scenario: Photo lourde choisie
- **WHEN** l'utilisateur choisit une photo et que sa préparation n'est pas terminée
- **THEN** l'écran affiche « Préparation de la photo… », puis l'écran de cadrage remplace l'indicateur

#### Scenario: Validation du cadrage
- **WHEN** l'utilisateur clique sur « Valider le cadrage » et que l'aperçu n'est pas encore calculé
- **THEN** l'écran affiche « Redressement de la photo… » et les boutons restent désactivés

#### Scenario: Recadrage d'un import en échec
- **WHEN** l'utilisateur lance la lecture depuis l'écran de recadrage et que l'envoi n'est pas terminé
- **THEN** l'écran affiche « Envoi de la photo… »

### Requirement: Imports en attente de lecture
Dans la liste des imports, chaque import « En attente » ou « Lecture en cours » SHALL afficher le motif animé à côté de son état. Les imports « Prêt à vérifier » et « Échec » MUST NOT l'afficher. Le libellé de l'état reste le texte annoncé.

#### Scenario: Lecture en cours
- **WHEN** la liste des imports contient un import « Lecture en cours » et un import « Prêt à vérifier »
- **THEN** seul l'import « Lecture en cours » affiche le motif animé

#### Scenario: Lecture terminée
- **WHEN** un import affiché « En attente » passe à « Prêt à vérifier » au rafraîchissement de la liste
- **THEN** son motif animé disparaît

### Requirement: Attentes de l'écran de correction
Sur l'écran de correction, le système SHALL afficher l'indicateur d'attente pendant l'enregistrement du round (« Enregistrement du round… ») et pendant la création d'un joueur depuis une ligne (« Création du joueur… »). L'indicateur MUST rester affiché jusqu'à l'ouverture de la page suivante quand l'enregistrement réussit.

#### Scenario: Enregistrement d'un round
- **WHEN** l'utilisateur clique sur « Enregistrer » et que la réponse du serveur n'est pas arrivée
- **THEN** l'écran affiche « Enregistrement du round… » et le bouton reste désactivé

#### Scenario: Création d'un joueur depuis une ligne
- **WHEN** l'utilisateur crée le joueur « Julien » depuis la ligne 1 et que la création n'est pas terminée
- **THEN** l'écran affiche « Création du joueur… » à côté de la ligne 1

### Requirement: Autres attentes de l'app
Le système SHALL afficher l'indicateur d'attente pendant l'ouverture de session (« Connexion… »), l'ajout ou le renommage d'un joueur (« Enregistrement du joueur… ») et la suppression d'un round (« Suppression du round… »).

#### Scenario: Ouverture de session
- **WHEN** l'utilisateur saisit le code et clique sur « Entrer » et que la réponse n'est pas arrivée
- **THEN** l'écran affiche « Connexion… »

#### Scenario: Suppression d'un round
- **WHEN** l'utilisateur confirme la suppression d'un round et que la réponse n'est pas arrivée
- **THEN** la boîte de confirmation affiche « Suppression du round… »
