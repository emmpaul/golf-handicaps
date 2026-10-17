# Spec Delta

## Purpose

Transformer une photo de carte de score du simulateur en round validé, avec une lecture OCR sans IA, des contrôles de cohérence et une correction manuelle possible de chaque valeur avant d'enregistrer.

## ADDED Requirements

### Requirement: Envoi d'une photo
Le système SHALL accepter une photo de carte de score prise au téléphone ou choisie dans les fichiers, dans un format que le navigateur sait afficher (JPEG, PNG, WebP, HEIC sur appareil Apple). Si le navigateur ne peut pas lire le fichier, le système SHALL afficher « Format de photo non lisible, exporte-la en JPEG » et proposer la saisie manuelle.

#### Scenario: Photo JPEG
- **WHEN** l'utilisateur choisit une photo JPEG de carte
- **THEN** la photo s'affiche à l'écran de cadrage

#### Scenario: Fichier illisible
- **WHEN** l'utilisateur choisit un fichier que le navigateur ne sait pas décoder
- **THEN** le système affiche « Format de photo non lisible, exporte-la en JPEG » et propose la saisie manuelle

### Requirement: Cadrage de la carte
Avant l'OCR, le système SHALL demander à l'utilisateur de placer 4 poignées sur les coins du panneau de la carte : du coin haut gauche du bandeau sombre (avec le nom du parcours) au coin bas droit de la bande « ROUND SETTINGS ». Les poignées sont pré-placées et déplaçables au doigt et à la souris. Le système SHALL redresser la photo selon ces 4 coins.

#### Scenario: Photo prise de biais
- **WHEN** l'utilisateur place les 4 coins sur une photo prise de biais et valide
- **THEN** le système affiche un aperçu de la carte redressée, en rectangle, avant de mettre la lecture en file

### Requirement: Lecture en tâche de fond
Une fois le cadrage validé, le système SHALL mettre la lecture en file d'attente et rendre la main tout de suite. Chaque import affiche son état (« En attente », « Lecture en cours », « Prêt à vérifier », « Échec »). L'utilisateur peut quitter la page et revenir plus tard. Plusieurs photos peuvent être en file en même temps.

#### Scenario: Plusieurs photos d'un coup
- **WHEN** l'utilisateur envoie et cadre 3 photos à la suite
- **THEN** les 3 imports apparaissent dans la liste des imports avec leur état, et chacun passe à « Prêt à vérifier » quand sa lecture est terminée

#### Scenario: Retour après fermeture
- **WHEN** l'utilisateur ferme l'app pendant une lecture puis la rouvre
- **THEN** l'import apparaît avec son état à jour, et son écran de correction s'ouvre s'il est « Prêt à vérifier »

#### Scenario: Échec de la lecture
- **WHEN** la lecture échoue deux fois de suite pour un import
- **THEN** l'import passe à « Échec » et propose de recadrer la photo ou d'ouvrir l'écran de correction vide

### Requirement: Lecture OCR sans service externe
Le système SHALL lire la carte par OCR exécuté sur le serveur de l'app, sans envoyer la photo à un service tiers. Pour la mise en page des cartes GSPro, il SHALL lire : le nom du parcours, les tees, la date, puis pour chaque trou le par, l'index et la distance, et pour chaque ligne de joueur le nom, les 18 scores et les totaux OUT, IN et TOT.

#### Scenario: Carte de référence IMG_3064
- **WHEN** l'utilisateur importe la photo de référence `IMG_3064` et cadre le tableau
- **THEN** l'écran de correction est pré-rempli avec le parcours « BETHPAGE BLACK », les tees « Red », la date 2026-10-17, 2 lignes de joueur et les pars 4,4,3,5,4,4,5,3,4,4,4,4,5,3,4,4,3,4

#### Scenario: Aucune lecture possible
- **WHEN** l'OCR ne reconnaît aucune valeur dans le tableau
- **THEN** le système ouvre l'écran de correction avec toutes les cases vides à remplir à la main, la photo restant visible

### Requirement: Date au format du simulateur
Le système SHALL lire la date de la carte au format mois/jour/année (« DATE: 10/17/2026 » donne le 17 octobre 2026). Si la date est absente ou illisible, le système SHALL proposer la date du jour, modifiable.

#### Scenario: Date américaine
- **WHEN** la carte affiche « DATE: 03/04/2026 »
- **THEN** la date proposée est le 4 mars 2026

### Requirement: Contrôles de cohérence
Le système SHALL vérifier : que la somme des trous 1 à 9 égale OUT, que celle des trous 10 à 18 égale IN, que OUT + IN égale TOT, que chaque par vaut 3, 4 ou 5, que les index forment une permutation de 1 à 18, et que chaque score vaut entre 1 et 15. Chaque case en défaut, ou que l'OCR n'a pas pu lire, MUST être surlignée.

#### Scenario: Total qui ne correspond pas
- **WHEN** l'OCR lit les trous 1 à 9 de Gab 5,5,3,5,4,4,4,3,3 avec OUT = 38
- **THEN** la ligne aller de Gab est surlignée avec le message « Somme aller 36 ≠ OUT 38 »

#### Scenario: Index en double
- **WHEN** les index lus contiennent deux fois la valeur 1 et pas de 11
- **THEN** les deux cases d'index valant 1 sont surlignées

### Requirement: Correction manuelle avant enregistrement
Le système SHALL afficher un écran de correction où chaque valeur lue est modifiable : parcours, tees, date, par, index, distance, chaque score et l'association joueur de chaque ligne. On peut aussi ajouter ou retirer une ligne de joueur. La photo reste visible à côté. Les contrôles de cohérence MUST se recalculer à chaque modification.

#### Scenario: Correction d'un score
- **WHEN** l'utilisateur remplace le score « 3 » du trou 9 de Gab par « 5 »
- **THEN** le surlignage « Somme aller 36 ≠ OUT 38 » disparaît

#### Scenario: Ajout d'une ligne oubliée
- **WHEN** l'OCR n'a détecté que 2 lignes alors que Sean jouait aussi
- **THEN** l'utilisateur peut ajouter une ligne, l'associer à Sean et saisir ses 18 scores

### Requirement: Enregistrement bloqué tant que la carte est incohérente
Le système MUST refuser d'enregistrer un round tant qu'il reste une case vide, une ligne sans joueur associé, deux lignes associées au même joueur ou un contrôle de cohérence en défaut. Le bouton d'enregistrement SHALL indiquer le nombre de problèmes restants.

#### Scenario: Carte complète et cohérente
- **WHEN** toutes les cases sont remplies et tous les contrôles passent
- **THEN** l'utilisateur peut enregistrer et le round apparaît dans la liste des rounds

#### Scenario: Problème restant
- **WHEN** une ligne de joueur n'est associée à personne
- **THEN** le bouton affiche « 1 problème à corriger » et l'enregistrement est impossible

### Requirement: Saisie entièrement manuelle
Le système SHALL permettre de créer un round sans photo, à partir du même écran de correction vide. Si le parcours et les tees choisis existent déjà, les pars, index et distances sont pré-remplis.

#### Scenario: Parcours déjà connu
- **WHEN** l'utilisateur crée un round sans photo et choisit « Bethpage Black / Red »
- **THEN** les pars, index et distances sont pré-remplis avec ceux du round précédent sur ce parcours

### Requirement: Détection de doublon
Avant d'enregistrer, le système SHALL avertir l'utilisateur si un round existe déjà avec le même parcours, les mêmes tees, la même date et les mêmes scores bruts pour les mêmes joueurs. L'utilisateur peut alors annuler ou enregistrer quand même.

#### Scenario: Même photo importée deux fois
- **WHEN** l'utilisateur importe une deuxième fois la carte `IMG_3064`
- **THEN** le système affiche « Ce round semble déjà enregistré » avec un lien vers le round existant

### Requirement: Conservation de la photo
Quand un round est importé depuis une photo, le système SHALL conserver la photo et l'afficher dans le détail du round.

#### Scenario: Consultation de la photo
- **WHEN** l'utilisateur ouvre le détail d'un round importé depuis une photo
- **THEN** la photo d'origine s'affiche
