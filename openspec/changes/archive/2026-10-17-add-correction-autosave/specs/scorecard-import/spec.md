# Spec Delta

## ADDED Requirements

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
