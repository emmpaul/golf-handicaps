# Spec Delta

## MODIFIED Requirements

### Requirement: Envoi d'une photo
Le système SHALL accepter une photo de carte de score prise au téléphone ou choisie dans les fichiers, dans un format que le navigateur sait afficher (JPEG, PNG, WebP, HEIC sur appareil Apple), et la mettre en file de lecture dès qu'elle est choisie, sans étape de cadrage. Si le navigateur ne peut pas lire le fichier, le système SHALL afficher « Format de photo non lisible, exporte-la en JPEG » et proposer la saisie manuelle.

#### Scenario: Photo JPEG
- **WHEN** l'utilisateur choisit une photo JPEG de carte
- **THEN** aucun écran de cadrage ne s'affiche, l'import apparaît « En attente » dans la liste des imports, et l'écran affiche « Lecture en file d'attente. Tu peux envoyer la photo suivante. »

#### Scenario: Fichier illisible
- **WHEN** l'utilisateur choisit un fichier que le navigateur ne sait pas décoder
- **THEN** le système affiche « Format de photo non lisible, exporte-la en JPEG » et propose la saisie manuelle

### Requirement: Cadrage de la carte
Le cadrage du panneau SHALL être trouvé automatiquement selon la capacité `scorecard-panel-detection`. Le système SHALL garder un recadrage manuel en repli : 4 poignées à placer sur les coins du panneau, du coin haut gauche du bandeau sombre (avec le nom du parcours) au coin bas droit de la bande « ROUND SETTINGS », déplaçables au doigt et à la souris, puis un aperçu redressé avant de relancer la lecture.

#### Scenario: Photo prise de biais
- **WHEN** l'utilisateur recadre un import en plaçant les 4 coins sur une photo prise de biais et valide
- **THEN** le système affiche un aperçu de la carte redressée, en rectangle, avant de relancer la lecture

#### Scenario: Envoi sans poignées
- **WHEN** l'utilisateur envoie une photo depuis l'écran d'import
- **THEN** aucune poignée ne s'affiche

### Requirement: Lecture en tâche de fond
Une fois la photo envoyée, le système SHALL mettre le cadrage et la lecture en file d'attente et rendre la main tout de suite. Chaque import affiche son état (« En attente », « Lecture en cours », « Prêt à vérifier », « Échec »). L'utilisateur peut quitter la page et revenir plus tard. Plusieurs photos peuvent être en file en même temps.

#### Scenario: Plusieurs photos d'un coup
- **WHEN** l'utilisateur envoie 3 photos à la suite
- **THEN** les 3 imports apparaissent dans la liste des imports avec leur état, et chacun passe à « Prêt à vérifier » quand sa lecture est terminée

#### Scenario: Retour après fermeture
- **WHEN** l'utilisateur ferme l'app pendant une lecture puis la rouvre
- **THEN** l'import apparaît avec son état à jour, et son écran de correction s'ouvre s'il est « Prêt à vérifier »

#### Scenario: Échec de la lecture
- **WHEN** la lecture échoue deux fois de suite pour un import
- **THEN** l'import passe à « Échec » et propose de recadrer la photo ou d'ouvrir l'écran de correction vide

#### Scenario: Panneau introuvable
- **WHEN** aucun cadrage n'est trouvé pour un import
- **THEN** l'import passe à « Échec » avec « Panneau introuvable sur la photo » et propose de recadrer la photo ou d'ouvrir l'écran de correction vide

### Requirement: Lecture OCR sans service externe
Le système SHALL lire la carte par OCR exécuté sur le serveur de l'app. La photo d'origine MUST NOT être envoyée à un service tiers. Deux exceptions, seulement si une clé d'API Anthropic est configurée : quand la détection locale ne trouve pas le panneau, une copie réduite de la photo peut être envoyée à l'API Claude selon `scorecard-panel-detection` ; quand la lecture locale laisse des problèmes, le panneau redressé peut l'être selon `scorecard-ai-completion`. Pour la mise en page des cartes GSPro, le système SHALL lire : le nom du parcours, les tees, la date, puis pour chaque trou le par, l'index et la distance, et pour chaque ligne de joueur le nom, les 18 scores et les totaux OUT, IN et TOT.

#### Scenario: Carte de référence IMG_3064
- **WHEN** l'utilisateur importe la photo de référence `IMG_3064`
- **THEN** l'écran de correction est pré-rempli avec le parcours « BETHPAGE BLACK », les tees « Red », la date 2026-10-17, 2 lignes de joueur et les pars 4,4,3,5,4,4,5,3,4,4,4,4,5,3,4,4,3,4

#### Scenario: Aucune lecture possible
- **WHEN** l'OCR ne reconnaît aucune valeur dans le tableau, que l'IA n'est pas disponible et qu'aucune complétion n'a lieu
- **THEN** le système ouvre l'écran de correction avec toutes les cases vides à remplir à la main, la photo restant visible

#### Scenario: Photo d'origine jamais envoyée
- **WHEN** une complétion ou un cadrage par IA est demandé pour un import
- **THEN** la photo n'est envoyée à aucun service tiers à sa taille d'origine ; seuls le panneau redressé ou la copie réduite sont envoyés

#### Scenario: Cadrage local réussi
- **WHEN** la détection locale trouve le panneau et que la lecture locale ne laisse aucun problème
- **THEN** aucune image de l'import n'est envoyée à un service tiers

### Requirement: Nouvelle lecture après recadrage
Le système SHALL permettre de recadrer un import en « Échec » ou « Prêt à vérifier » qui n'a pas encore de round, depuis la liste des imports et depuis l'écran de correction. Recadrer SHALL effacer la correction enregistrée : la nouvelle lecture OCR devient le point de départ de l'écran de correction. Si une correction est enregistrée, l'écran de recadrage SHALL afficher « Recadrer relance la lecture et remplace tes corrections » avant la validation. Un import en lecture ou déjà enregistré en round MUST NOT être recadré.

#### Scenario: Recadrage d'un import corrigé
- **WHEN** l'utilisateur a saisi la date 2026-10-13 sur l'écran de correction d'un import en « Échec », puis recadre la photo et que la nouvelle lecture donne la date 2026-10-17
- **THEN** l'écran de correction affiche la date 2026-10-17

#### Scenario: Avertissement avant recadrage
- **WHEN** l'utilisateur ouvre l'écran de recadrage d'un import qui a une correction enregistrée
- **THEN** l'écran affiche « Recadrer relance la lecture et remplace tes corrections »

#### Scenario: Recadrage sans correction
- **WHEN** l'utilisateur ouvre l'écran de recadrage d'un import sans correction enregistrée
- **THEN** l'avertissement ne s'affiche pas

#### Scenario: Cadrage automatique à côté
- **WHEN** un import est « Prêt à vérifier » avec une lecture fausse parce que le cadrage trouvé coupe le tableau, et que l'utilisateur touche « Recadrer la photo » sur l'écran de correction, place les 4 coins et lance la lecture
- **THEN** l'import repasse « En attente », puis la lecture utilise les coins placés à la main, sans nouvelle détection

#### Scenario: Import déjà enregistré
- **WHEN** un recadrage est demandé pour un import dont le round est enregistré
- **THEN** le système le refuse et l'import ne change pas

### Requirement: Prise de photo depuis l'app
Sur un appareil à écran tactile, l'écran d'import SHALL proposer « Prendre une photo », qui ouvre directement l'appareil photo arrière sans passer par la photothèque. La photo prise MUST suivre le même parcours qu'une photo choisie dans les fichiers : mise en file immédiate, cadrage automatique, et même message si le format est illisible. Le choix d'un fichier SHALL rester disponible. Sur un appareil sans écran tactile, « Prendre une photo » MUST NOT s'afficher.

#### Scenario: Photo prise au téléphone
- **WHEN** sur iPhone, l'utilisateur touche « Prendre une photo » et prend la photo de la carte de référence
- **THEN** l'import apparaît « En attente » dans la liste des imports, comme une photo choisie dans les fichiers

#### Scenario: Prise de vue annulée
- **WHEN** l'utilisateur touche « Prendre une photo » puis annule dans l'appareil photo
- **THEN** l'écran d'import reste tel qu'il était, sans message d'erreur

#### Scenario: Photo déjà prise
- **WHEN** sur iPhone, l'utilisateur veut importer une photo déjà dans sa photothèque
- **THEN** le champ « Photo de la carte » est toujours là et permet de la choisir

#### Scenario: Ordinateur
- **WHEN** l'utilisateur ouvre l'écran d'import sur un ordinateur sans écran tactile
- **THEN** « Prendre une photo » ne s'affiche pas et « Photo de la carte » reste disponible
