# Spec Delta

## MODIFIED Requirements

### Requirement: Marquage des cases complétées par l'IA
L'écran de correction SHALL marquer de façon visible chaque case dont la valeur vient de l'IA, et l'indiquer aussi aux lecteurs d'écran. Une case modifiée à la main n'est plus marquée, y compris après un rechargement de l'écran ou sur un autre appareil. Les contrôles de cohérence et le blocage de l'enregistrement restent ceux de `scorecard-import`.

#### Scenario: Case marquée
- **WHEN** l'utilisateur ouvre l'écran de correction d'un import où l'IA a rempli le score de Gab au trou 9
- **THEN** cette case porte la marque « complété par l'IA » et les autres cases ne la portent pas

#### Scenario: Marque retirée après modification
- **WHEN** l'utilisateur remplace la valeur d'une case marquée
- **THEN** la case n'est plus marquée

#### Scenario: Marque toujours retirée après rechargement
- **WHEN** l'IA a rempli le score de Gab au trou 9, que l'utilisateur le remplace par 4, attend « Enregistré » puis recharge la page
- **THEN** la case de Gab au trou 9 vaut 4 et ne porte pas la marque « complété par l'IA », et aucune autre case ne la porte
