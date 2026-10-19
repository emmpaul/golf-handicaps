# Spec Delta

## MODIFIED Requirements

### Requirement: Plafond de dépense mensuel
Le système SHALL calculer le coût de chaque appel à l'IA, de cadrage ou de complétion, à partir de l'usage en tokens renvoyé par l'API et des tarifs du modèle, et le cumuler par mois civil, compté dans le fuseau horaire IANA de la variable `AI_BUDGET_TIME_ZONE` (`America/Montreal` par défaut). Un fuseau inconnu MUST faire échouer le démarrage du web et du worker avec un message qui nomme la variable. Avant un appel, si le cumul du mois plus le coût maximal de cet appel dépasse le plafond configuré (1 $ par défaut), le système MUST NOT appeler l'IA. Pour une complétion, l'import passe alors à « Prêt à vérifier » avec le brouillon local et le message « Budget IA du mois atteint ».

#### Scenario: Plafond atteint
- **WHEN** le cumul du mois atteint le plafond et qu'une carte lue localement a des cases vides
- **THEN** aucun appel n'est fait, et l'import est « Prêt à vérifier » avec le message « Budget IA du mois atteint »

#### Scenario: Nouveau mois
- **WHEN** le plafond a été atteint en octobre et qu'une carte incomplète est importée en novembre
- **THEN** l'appel à l'IA est fait

#### Scenario: Cadrage compté dans le cumul
- **WHEN** un appel de cadrage a coûté 12 000 micro-dollars en octobre
- **THEN** le cumul d'octobre augmente d'exactement 12 000 micro-dollars, comme pour un appel de complétion

#### Scenario: Fuseau par défaut
- **WHEN** `AI_BUDGET_TIME_ZONE` est absente et qu'un appel a lieu le 1er novembre 2026 à 02:30 UTC
- **THEN** son coût s'ajoute au cumul d'octobre 2026 (22:30 le 31 octobre à Montréal)

#### Scenario: Fuseau configuré
- **WHEN** `AI_BUDGET_TIME_ZONE=Europe/Paris` et qu'un appel a lieu le 1er novembre 2026 à 02:30 UTC
- **THEN** son coût s'ajoute au cumul de novembre 2026 (03:30 le 1er novembre à Paris)

#### Scenario: Fuseau inconnu
- **WHEN** le web ou le worker démarre avec `AI_BUDGET_TIME_ZONE=Mars/Olympus`
- **THEN** le démarrage échoue avec un message qui nomme `AI_BUDGET_TIME_ZONE`
