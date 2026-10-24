## MODIFIED Requirements

### Requirement: Dernier round
La page d'accueil SHALL afficher le round le plus récent par date de jeu : parcours, tees, date, score brut de chaque joueur et gagnant net, avec un lien vers la page du round. Le parcours et les tees MUST être deux éléments distincts, sans point médian entre eux. Sans round, elle MUST afficher « Aucun round enregistré » à la place.

#### Scenario: Dernier round affiché
- **WHEN** le round le plus récent est BETHPAGE BLACK / Red du 17 octobre 2026, Gab 72 et Manu 88, gagnant net Gab
- **THEN** l'accueil affiche « BETHPAGE BLACK », « Tees Red », « 17 octobre 2026 », « Gab 72 », « Manu 88 » et « Gagnant net : Gab », sans « · », et le bloc mène à la page de ce round

#### Scenario: Base vide
- **WHEN** aucun round n'est enregistré
- **THEN** l'accueil affiche « Aucun round enregistré »
