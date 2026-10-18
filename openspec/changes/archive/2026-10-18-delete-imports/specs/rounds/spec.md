# Spec Delta

## MODIFIED Requirements

### Requirement: Suppression d'un round
Le système SHALL permettre de supprimer un round après une confirmation. La suppression MUST retirer le round de l'historique et du calcul des index, puis recalculer les index des joueurs du round. Pour un round importé depuis une photo, la suppression MUST aussi retirer son import de la liste des imports et effacer la photo du serveur.

#### Scenario: Suppression confirmée
- **WHEN** l'utilisateur supprime un round et confirme
- **THEN** le round disparaît de la liste et l'index de chaque joueur concerné est recalculé sans lui

#### Scenario: Suppression annulée
- **WHEN** l'utilisateur demande la suppression puis annule
- **THEN** le round reste inchangé

#### Scenario: Round importé supprimé
- **WHEN** l'utilisateur supprime un round importé depuis la photo `IMG_3064` et confirme
- **THEN** l'import de cette photo n'apparaît plus dans la liste des imports (il ne revient pas « Prêt à vérifier »), et la photo n'est plus servie

#### Scenario: Round saisi à la main supprimé
- **WHEN** l'utilisateur supprime un round créé sans photo et confirme
- **THEN** le round disparaît de la liste et la liste des imports ne change pas
