# Spec Delta

## MODIFIED Requirements

### Requirement: Déclenchement uniquement en repli
Après la lecture locale d'une carte, le système SHALL demander une complétion par IA seulement si le brouillon a au moins un problème : une case obligatoire vide, ou un contrôle de cohérence de `scorecard-import` en échec. Une date ou une distance absente n'est pas un problème. Le système MUST NOT faire plus d'un appel de complétion par lecture. Un éventuel appel de cadrage selon `scorecard-panel-detection` est distinct : une lecture compte donc au plus deux appels, un de cadrage puis un de complétion.

#### Scenario: Carte lue sans problème
- **WHEN** la lecture locale de la photo de référence `IMG_3064` donne un brouillon complet et cohérent
- **THEN** aucun appel à l'IA n'est fait, et le brouillon est celui de la lecture locale

#### Scenario: Cases vides
- **WHEN** la lecture locale laisse vide le score de Gab au trou 9
- **THEN** le système fait exactement un appel de complétion pour cette carte

#### Scenario: Total incohérent
- **WHEN** la lecture locale donne pour Gab les trous 1 à 9 = 5,5,3,5,4,4,4,3,3 avec OUT = 38
- **THEN** le système fait exactement un appel de complétion pour cette carte

#### Scenario: Cadrage et complétion par l'IA
- **WHEN** la détection locale échoue, que l'IA trouve le panneau, puis que la lecture locale laisse vide le score de Gab au trou 9
- **THEN** le système fait exactement deux appels pour cet import : un de cadrage, puis un de complétion

### Requirement: Plafond de dépense mensuel
Le système SHALL calculer le coût de chaque appel à l'IA, de cadrage ou de complétion, à partir de l'usage en tokens renvoyé par l'API et des tarifs du modèle, et le cumuler par mois civil. Avant un appel, si le cumul du mois plus le coût maximal de cet appel dépasse le plafond configuré (1 $ par défaut), le système MUST NOT appeler l'IA. Pour une complétion, l'import passe alors à « Prêt à vérifier » avec le brouillon local et le message « Budget IA du mois atteint ».

#### Scenario: Plafond atteint
- **WHEN** le cumul du mois atteint le plafond et qu'une carte lue localement a des cases vides
- **THEN** aucun appel n'est fait, et l'import est « Prêt à vérifier » avec le message « Budget IA du mois atteint »

#### Scenario: Nouveau mois
- **WHEN** le plafond a été atteint en octobre et qu'une carte incomplète est importée en novembre
- **THEN** l'appel à l'IA est fait

#### Scenario: Cadrage compté dans le cumul
- **WHEN** un appel de cadrage a coûté 12 000 micro-dollars en octobre
- **THEN** le cumul d'octobre augmente d'exactement 12 000 micro-dollars, comme pour un appel de complétion
