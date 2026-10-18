# Spec Delta

## ADDED Requirements

### Requirement: Suppression d'un import
Le système SHALL permettre de supprimer, après une confirmation, un import pas encore enregistré en round : « En attente », « Prêt à vérifier » ou « Échec ». La suppression MUST retirer l'import de la liste, effacer sa photo du serveur et annuler sa lecture en attente. Un import en « Lecture en cours » ou déjà enregistré en round MUST NOT être supprimé.

#### Scenario: Import en échec supprimé
- **WHEN** l'utilisateur supprime un import en « Échec » et confirme
- **THEN** l'import disparaît de la liste des imports, et sa photo n'est plus servie (« Photo introuvable »)

#### Scenario: Import prêt avec une correction en cours
- **WHEN** l'utilisateur a corrigé des cases d'un import « Prêt à vérifier », puis le supprime et confirme
- **THEN** l'import disparaît de la liste et son écran de correction n'est plus accessible

#### Scenario: Import en attente supprimé
- **WHEN** l'utilisateur supprime un import « En attente » et confirme
- **THEN** l'import disparaît de la liste et le worker ne lit jamais sa photo

#### Scenario: Suppression annulée
- **WHEN** l'utilisateur demande la suppression d'un import puis annule
- **THEN** l'import reste dans la liste avec son état, sa photo et sa correction

#### Scenario: Import en lecture
- **WHEN** une demande de suppression arrive pour un import en « Lecture en cours »
- **THEN** le système refuse avec « Lecture en cours » et l'import ne change pas

#### Scenario: Import déjà enregistré en round
- **WHEN** une demande de suppression arrive pour un import enregistré en round
- **THEN** le système refuse avec « Cette carte est déjà enregistrée », et l'import, le round et la photo ne changent pas

#### Scenario: Imports qui proposent la suppression
- **WHEN** l'utilisateur regarde la liste des imports
- **THEN** « Supprimer » est proposé sur les imports « En attente », « Prêt à vérifier » et « Échec » sans round, et sur aucun autre
