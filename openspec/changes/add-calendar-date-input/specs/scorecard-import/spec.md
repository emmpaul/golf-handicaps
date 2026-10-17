# Spec Delta

## ADDED Requirements

### Requirement: Choix de la date au calendrier
Sur l'écran de correction, la date SHALL s'afficher en toutes lettres en français (« 17 octobre 2026 ») et se choisir dans un calendrier qui s'ouvre au toucher ou au clic. Le calendrier MUST être en français, commencer la semaine le lundi, s'ouvrir sur le mois de la date affichée avec ce jour sélectionné, et permettre de choisir le mois et l'année sans parcourir les mois un par un. La date enregistrée MUST être le jour choisi, quel que soit le fuseau horaire de l'appareil.

#### Scenario: Ouverture sur la date lue
- **WHEN** l'utilisateur ouvre le calendrier de l'import de la carte de référence, dont la date lue est le 17 octobre 2026
- **THEN** le calendrier affiche octobre 2026, le 17 est sélectionné et la première colonne est le lundi

#### Scenario: Choix d'un autre jour
- **WHEN** l'utilisateur choisit le 13 dans le calendrier ouvert sur octobre 2026
- **THEN** le calendrier se ferme, la date affichée devient « 13 octobre 2026 », et le round enregistré a la date 2026-10-13

#### Scenario: Changement de mois et d'année
- **WHEN** l'utilisateur, sur un calendrier ouvert sur octobre 2026, choisit mars puis 2025 puis le 4
- **THEN** la date affichée devient « 4 mars 2025 »

#### Scenario: Fuseau horaire à l'ouest de Greenwich
- **WHEN** sur un appareil réglé à l'heure de Montréal, l'utilisateur ouvre un round enregistré le 2026-10-17
- **THEN** la date affichée est « 17 octobre 2026 », pas le 16

### Requirement: Calendrier utilisable au clavier et au doigt
Le calendrier SHALL se piloter au clavier : flèches pour changer de jour, Entrée pour choisir, Échap pour fermer sans rien changer, le focus revenant ensuite sur le champ « Date ». Sur téléphone, chaque jour MUST offrir une zone de toucher d'au moins 44 px et le calendrier MUST tenir dans l'écran sans défilement horizontal.

#### Scenario: Choix au clavier
- **WHEN** l'utilisateur ouvre le calendrier au clavier sur le 17 octobre 2026, appuie deux fois sur Flèche gauche puis sur Entrée
- **THEN** la date affichée devient « 15 octobre 2026 » et le focus est sur le champ « Date »

#### Scenario: Fermeture sans choix
- **WHEN** l'utilisateur ouvre le calendrier puis appuie sur Échap
- **THEN** le calendrier se ferme et la date affichée ne change pas

#### Scenario: Calendrier sur iPhone
- **WHEN** l'utilisateur ouvre le calendrier sur un iPhone
- **THEN** chaque jour mesure au moins 44 px de côté et la page n'a pas de défilement horizontal

### Requirement: Marques sur le champ de date
Le champ « Date » SHALL porter les mêmes marques qu'un autre champ de l'écran de correction : surlignage et annonce quand la date manque, marque « complété par l'IA » quand la date vient de l'IA. Choisir une date dans le calendrier MUST retirer la marque de l'IA.

#### Scenario: Date complétée par l'IA puis modifiée
- **WHEN** l'IA a rempli la date d'un import et que l'utilisateur choisit un autre jour dans le calendrier
- **THEN** le champ « Date » ne porte plus la marque « complété par l'IA »
