# Spec Delta

## ADDED Requirements

### Requirement: Retrait d'un alias
Le système SHALL permettre de retirer un alias d'un joueur depuis la page Joueurs, sans confirmation. Un alias retiré MUST NOT servir à associer les lignes des imports suivants. Les rounds déjà enregistrés ne changent pas.

#### Scenario: Alias appris par erreur
- **WHEN** l'alias « SEANP » a été appris pour Manu par erreur, et l'utilisateur le retire de Manu
- **THEN** « SEANP » n'apparaît plus dans les alias de Manu, et à l'import suivant une ligne « SEANP » n'est plus associée à Manu

#### Scenario: Alias réappris
- **WHEN** l'utilisateur a retiré l'alias « SEANP » de Manu, puis associe à la main une ligne « SEANP » à Sean et enregistre le round
- **THEN** « SEANP » apparaît dans les alias de Sean

#### Scenario: Rounds déjà enregistrés
- **WHEN** l'utilisateur retire un alias de Manu
- **THEN** les rounds de Manu et son index ne changent pas
