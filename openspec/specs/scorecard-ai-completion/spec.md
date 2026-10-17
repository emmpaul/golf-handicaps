# scorecard-ai-completion Specification

## Purpose
Compléter par un modèle de vision d'Anthropic une carte que la lecture locale n'a pas su lire entièrement. L'IA ne sert qu'en repli, une fois par carte, sous un plafond de dépense mensuel. La correction manuelle reste obligatoire.

## Requirements

### Requirement: Déclenchement uniquement en repli
Après la lecture locale d'une carte, le système SHALL demander une complétion par IA seulement si le brouillon a au moins un problème : une case obligatoire vide, ou un contrôle de cohérence de `scorecard-import` en échec. Une date ou une distance absente n'est pas un problème. Le système MUST NOT faire plus d'un appel à l'IA par lecture.

#### Scenario: Carte lue sans problème
- **WHEN** la lecture locale de la photo de référence `IMG_3064` donne un brouillon complet et cohérent
- **THEN** aucun appel à l'IA n'est fait, et le brouillon est celui de la lecture locale

#### Scenario: Cases vides
- **WHEN** la lecture locale laisse vide le score de Gab au trou 9
- **THEN** le système fait exactement un appel à l'IA pour cette carte

#### Scenario: Total incohérent
- **WHEN** la lecture locale donne pour Gab les trous 1 à 9 = 5,5,3,5,4,4,4,3,3 avec OUT = 38
- **THEN** le système fait exactement un appel à l'IA pour cette carte

### Requirement: Données envoyées
Pour une complétion, le système SHALL envoyer à Anthropic une seule image : le panneau de la carte redressé selon les 4 coins. Il MUST NOT envoyer la photo d'origine, ni aucune autre donnée de l'app (index, historique, autres rounds).

#### Scenario: Image envoyée
- **WHEN** une complétion est demandée pour un import
- **THEN** la requête contient une seule image, aux dimensions du panneau redressé, et aucune autre image

### Requirement: Fusion avec la lecture locale
Le système SHALL ne remplacer par la valeur de l'IA que les cases en problème : vides, ou concernées par un contrôle en échec. Une case lue localement qui ne participe à aucun problème MUST garder sa valeur locale. Si l'IA ne donne pas de valeur pour une case en problème, la case reste comme la lecture locale l'a laissée.

#### Scenario: Case vide complétée
- **WHEN** le score de Gab au trou 9 est vide après la lecture locale et que l'IA lit 5
- **THEN** le brouillon contient 5 pour Gab au trou 9

#### Scenario: Case cohérente conservée
- **WHEN** la lecture locale a lu 7 pour Manu au trou 1, sans problème sur sa ligne, et que l'IA lit 1
- **THEN** le brouillon garde 7 pour Manu au trou 1

### Requirement: Marquage des cases complétées par l'IA
L'écran de correction SHALL marquer de façon visible chaque case dont la valeur vient de l'IA, et l'indiquer aussi aux lecteurs d'écran. Une case modifiée à la main n'est plus marquée. Les contrôles de cohérence et le blocage de l'enregistrement restent ceux de `scorecard-import`.

#### Scenario: Case marquée
- **WHEN** l'utilisateur ouvre l'écran de correction d'un import où l'IA a rempli le score de Gab au trou 9
- **THEN** cette case porte la marque « complété par l'IA » et les autres cases ne la portent pas

#### Scenario: Marque retirée après modification
- **WHEN** l'utilisateur remplace la valeur d'une case marquée
- **THEN** la case n'est plus marquée

### Requirement: Plafond de dépense mensuel
Le système SHALL calculer le coût de chaque appel à l'IA à partir de l'usage en tokens renvoyé par l'API et des tarifs du modèle, et le cumuler par mois civil. Avant un appel, si le cumul du mois plus le coût maximal d'un appel dépasse le plafond configuré (1 $ par défaut), le système MUST NOT appeler l'IA. L'import passe alors à « Prêt à vérifier » avec le brouillon local et le message « Budget IA du mois atteint ».

#### Scenario: Plafond atteint
- **WHEN** le cumul du mois atteint le plafond et qu'une carte lue localement a des cases vides
- **THEN** aucun appel n'est fait, et l'import est « Prêt à vérifier » avec le message « Budget IA du mois atteint »

#### Scenario: Nouveau mois
- **WHEN** le plafond a été atteint en octobre et qu'une carte incomplète est importée en novembre
- **THEN** l'appel à l'IA est fait

### Requirement: Fonction optionnelle et sans blocage
Sans clé d'API Anthropic configurée, le système SHALL se comporter comme sans cette capacité : aucun appel, aucun message. Si l'appel échoue (erreur réseau, erreur de l'API, refus, réponse illisible), le système SHALL tout de même passer l'import à « Prêt à vérifier » avec le brouillon local et le message « Complétion IA indisponible ». Il MUST NOT passer l'import en « Échec » à cause de l'IA.

#### Scenario: Sans clé
- **WHEN** aucune clé d'API n'est configurée et qu'une carte lue localement a des cases vides
- **THEN** aucun appel n'est fait et l'import est « Prêt à vérifier » avec le brouillon local, sans message sur l'IA

#### Scenario: Erreur de l'API
- **WHEN** l'API répond par une erreur à la demande de complétion
- **THEN** l'import est « Prêt à vérifier » avec le brouillon local et le message « Complétion IA indisponible »
