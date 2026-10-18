# scorecard-import Specification

## Purpose
Transformer une photo de carte de score du simulateur en round validé, avec une lecture OCR sans IA, des contrôles de cohérence et une correction manuelle possible de chaque valeur avant d'enregistrer.

## Requirements

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
Le système SHALL lire la carte par OCR exécuté sur le serveur de l'app. La photo d'origine MUST NOT être envoyée à un service tiers. Seule exception : quand la lecture locale laisse des problèmes et qu'une clé d'API Anthropic est configurée, le panneau redressé peut être envoyé à l'API Claude selon la capacité `scorecard-ai-completion`. Pour la mise en page des cartes GSPro, le système SHALL lire : le nom du parcours, les tees, la date, puis pour chaque trou le par, l'index et la distance, et pour chaque ligne de joueur le nom, les 18 scores et les totaux OUT, IN et TOT.

#### Scenario: Carte de référence IMG_3064
- **WHEN** l'utilisateur importe la photo de référence `IMG_3064` et cadre le tableau
- **THEN** l'écran de correction est pré-rempli avec le parcours « BETHPAGE BLACK », les tees « Red », la date 2026-10-17, 2 lignes de joueur et les pars 4,4,3,5,4,4,5,3,4,4,4,4,5,3,4,4,3,4

#### Scenario: Aucune lecture possible
- **WHEN** l'OCR ne reconnaît aucune valeur dans le tableau, que l'IA n'est pas disponible et qu'aucune complétion n'a lieu
- **THEN** le système ouvre l'écran de correction avec toutes les cases vides à remplir à la main, la photo restant visible

#### Scenario: Photo d'origine jamais envoyée
- **WHEN** une complétion par IA est demandée pour un import
- **THEN** la photo d'origine n'est envoyée à aucun service tiers ; seul le panneau redressé est envoyé

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

### Requirement: Sauvegarde automatique de la correction d'un import
Sur l'écran de correction d'un import, le système SHALL enregistrer sur le serveur chaque modification sans action de l'utilisateur : au plus tard 2 s après la dernière modification, et aussi quand la page passe en arrière-plan ou se ferme. L'état enregistré couvre le parcours, les tees, la date, toutes les cases, les lignes de joueur avec leur joueur associé, et les cases encore marquées IA. La lecture OCR d'origine MUST rester inchangée.

#### Scenario: Joueur choisi et case corrigée, puis rechargement
- **WHEN** sur l'import de la carte de référence où la ligne 1 a été lue « JULIEN », l'utilisateur associe la ligne 1 à Gab, remplace le score 7 de Manu au trou 1 par 6, attend « Enregistré » puis recharge la page
- **THEN** la ligne 1 est associée à Gab et la case de Manu au trou 1 vaut 6

#### Scenario: Date modifiée, puis rechargement
- **WHEN** l'utilisateur remplace la date 2026-10-17 lue sur la carte par 2026-10-13, attend « Enregistré » puis recharge la page
- **THEN** la date affichée est 2026-10-13

#### Scenario: Page fermée juste après une modification
- **WHEN** l'utilisateur remplace le score de Gab au trou 9 par 4 puis ferme l'onglet moins d'une seconde après
- **THEN** à la réouverture de l'import, la case de Gab au trou 9 vaut 4

#### Scenario: Lecture d'origine conservée
- **WHEN** l'utilisateur a corrigé des cases d'un import et que la correction est enregistrée
- **THEN** la lecture OCR de l'import garde les valeurs lues, et seule la correction enregistrée porte les valeurs modifiées

### Requirement: Reprise de la correction enregistrée
À l'ouverture de l'écran de correction d'un import, le système SHALL afficher la dernière correction enregistrée pour cet import, quel que soit l'appareil ou le membre du groupe qui l'a faite. Sans correction enregistrée, ou si elle est illisible, le système SHALL partir de la lecture OCR comme avant ; pour un import en « Échec », de l'écran vide.

#### Scenario: Autre appareil
- **WHEN** l'utilisateur associe la ligne 2 à Sean sur son téléphone, voit « Enregistré », puis ouvre le même import sur son ordinateur
- **THEN** la ligne 2 est associée à Sean sur l'ordinateur

#### Scenario: Import en échec corrigé à la main
- **WHEN** sur l'écran de correction vide d'un import en « Échec », l'utilisateur saisit le parcours « BETHPAGE BLACK » et la date 2026-10-13, attend « Enregistré » puis recharge la page
- **THEN** le parcours vaut « BETHPAGE BLACK » et la date 2026-10-13, au lieu d'un écran vide daté du jour

#### Scenario: Correction enregistrée illisible
- **WHEN** la correction enregistrée d'un import ne respecte pas le format attendu
- **THEN** l'écran s'ouvre pré-rempli par la lecture OCR, sans erreur

#### Scenario: Deux modifications concurrentes
- **WHEN** deux membres du groupe corrigent le même import en même temps
- **THEN** la dernière correction reçue par le serveur est celle qu'affiche la prochaine ouverture

### Requirement: Indicateur d'enregistrement
L'écran de correction d'un import SHALL afficher l'état de la sauvegarde automatique : « Enregistrement… » pendant l'envoi, « Enregistré » une fois la correction acceptée, « Modifications non enregistrées » après un échec. Cet état MUST être annoncé aux lecteurs d'écran sans interrompre la saisie. Un échec MUST NOT bloquer la correction ni l'enregistrement du round, et le système SHALL réessayer.

#### Scenario: Enregistrement réussi
- **WHEN** l'utilisateur remplace un score et que le serveur accepte la correction
- **THEN** l'indicateur passe de « Enregistrement… » à « Enregistré »

#### Scenario: Serveur injoignable
- **WHEN** l'utilisateur remplace un score alors que le serveur ne répond pas
- **THEN** l'indicateur affiche « Modifications non enregistrées », les cases restent modifiables, et la correction est envoyée à nouveau quand le serveur répond

#### Scenario: Écran ouvert sans modification
- **WHEN** l'utilisateur ouvre l'écran de correction d'un import sans rien modifier
- **THEN** aucune sauvegarde n'est envoyée et l'indicateur n'affiche rien

### Requirement: Correction refusée hors vérification
Le système SHALL accepter une correction enregistrée seulement pour un import « Prêt à vérifier » ou en « Échec » qui n'a pas encore de round. Pour un import inconnu, il SHALL répondre « Import introuvable ». Pour un import en lecture ou déjà enregistré en round, il MUST refuser la correction sans rien modifier, et l'écran SHALL afficher « Cette carte est déjà enregistrée » quand un round existe.

#### Scenario: Round déjà enregistré par un autre membre
- **WHEN** Gab enregistre le round d'un import pendant que Manu a encore l'écran de correction de cet import ouvert, puis que Manu modifie une case
- **THEN** la correction de Manu est refusée, son écran affiche « Cette carte est déjà enregistrée », et le round enregistré par Gab ne change pas

#### Scenario: Import en lecture
- **WHEN** une correction est envoyée pour un import « En attente » ou « Lecture en cours »
- **THEN** le système la refuse et l'import ne change pas

### Requirement: Nouvelle lecture après recadrage
Quand l'utilisateur recadre un import, le système SHALL effacer la correction enregistrée : la nouvelle lecture OCR devient le point de départ de l'écran de correction. Si une correction est enregistrée, l'écran de recadrage SHALL afficher « Recadrer relance la lecture et remplace tes corrections » avant la validation.

#### Scenario: Recadrage d'un import corrigé
- **WHEN** l'utilisateur a saisi la date 2026-10-13 sur l'écran de correction d'un import en « Échec », puis recadre la photo et que la nouvelle lecture donne la date 2026-10-17
- **THEN** l'écran de correction affiche la date 2026-10-17

#### Scenario: Avertissement avant recadrage
- **WHEN** l'utilisateur ouvre l'écran de recadrage d'un import qui a une correction enregistrée
- **THEN** l'écran affiche « Recadrer relance la lecture et remplace tes corrections »

#### Scenario: Recadrage sans correction
- **WHEN** l'utilisateur ouvre l'écran de recadrage d'un import sans correction enregistrée
- **THEN** l'avertissement ne s'affiche pas

### Requirement: Prise de photo depuis l'app
Sur un appareil à écran tactile, l'écran d'import SHALL proposer « Prendre une photo », qui ouvre directement l'appareil photo arrière sans passer par la photothèque. La photo prise MUST suivre le même parcours qu'une photo choisie dans les fichiers : cadrage, aperçu redressé, mise en file, et même message si le format est illisible. Le choix d'un fichier SHALL rester disponible. Sur un appareil sans écran tactile, « Prendre une photo » MUST NOT s'afficher.

#### Scenario: Photo prise au téléphone
- **WHEN** sur iPhone, l'utilisateur touche « Prendre une photo » et prend la photo de la carte de référence
- **THEN** la photo s'affiche à l'écran de cadrage, comme une photo choisie dans les fichiers

#### Scenario: Prise de vue annulée
- **WHEN** l'utilisateur touche « Prendre une photo » puis annule dans l'appareil photo
- **THEN** l'écran d'import reste tel qu'il était, sans message d'erreur

#### Scenario: Photo déjà prise
- **WHEN** sur iPhone, l'utilisateur veut importer une photo déjà dans sa photothèque
- **THEN** le champ « Photo de la carte » est toujours là et permet de la choisir

#### Scenario: Ordinateur
- **WHEN** l'utilisateur ouvre l'écran d'import sur un ordinateur sans écran tactile
- **THEN** « Prendre une photo » ne s'affiche pas et « Photo de la carte » reste disponible

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
