# Spec Delta

## MODIFIED Requirements

### Requirement: Différentiel d'un round
Le système SHALL calculer le différentiel d'un joueur sur un round : (113 / slope) × (score ajusté − course rating), arrondi au dixième le plus proche, 0,05 arrondi vers le haut. La course rating et le slope sont ceux confirmés pour le parcours et les tees du round. Sans rating confirmée, la course rating vaut le par total du round et le slope 113. Le différentiel est un nombre à une décimale.

#### Scenario: Différentiels de la carte de référence
- **WHEN** la carte `IMG_3064` (par 71) est enregistrée et que « BETHPAGE BLACK / Red » n'a pas de rating confirmée
- **THEN** le différentiel de Gab vaut 1,0 et celui de Manu 17,0

#### Scenario: Différentiels avec rating
- **WHEN** « BETHPAGE BLACK / Red » a une rating confirmée de 71,4 et un slope de 144, et que la carte `IMG_3064` est enregistrée
- **THEN** le différentiel de Gab vaut 0,5 et celui de Manu 13,0

### Requirement: Recalcul complet
Après tout ajout, correction ou suppression de round, et après toute confirmation ou correction de la rating d'un parcours, le système SHALL recalculer les différentiels et tout l'historique d'index des joueurs concernés, y compris pour les rounds postérieurs à la date modifiée.

#### Scenario: Round ajouté dans le passé
- **WHEN** l'utilisateur enregistre un round daté d'avant les autres rounds de Gab
- **THEN** les index de Gab après chacun de ses rounds suivants sont recalculés avec ce round

#### Scenario: Rating confirmée après coup
- **WHEN** Gab a trois rounds, dont un sur « BETHPAGE BLACK / Red », et que l'utilisateur confirme la rating de ce parcours
- **THEN** le différentiel de ce round et les index de Gab après ce round et après les suivants sont recalculés avec cette rating
