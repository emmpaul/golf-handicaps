# Spec Delta

## MODIFIED Requirements

### Requirement: Conservation de la photo
Quand un round est importé depuis une photo, le système SHALL conserver la photo et l'afficher dans le détail du round. La photo MUST être conservée au format WebP ; le fichier envoyé par le navigateur MUST NOT être écrit tel quel sur le serveur. La photo conservée sert aussi à la lecture OCR de l'import.

#### Scenario: Consultation de la photo
- **WHEN** l'utilisateur ouvre le détail d'un round importé depuis une photo
- **THEN** la photo d'origine s'affiche

#### Scenario: Photo stockée en WebP
- **WHEN** l'utilisateur envoie la photo JPEG d'une carte et valide le cadrage
- **THEN** le serveur ne garde de cette photo qu'un fichier WebP, et la photo de l'import est servie avec le type `image/webp`

#### Scenario: Lecture inchangée après conversion
- **WHEN** l'utilisateur importe la photo de référence `IMG_3064` et cadre le tableau
- **THEN** l'écran de correction est pré-rempli avec la même lecture qu'avant la conversion en WebP : parcours « BETHPAGE BLACK », tees « Red », date 2026-10-17, 2 lignes de joueur et pars 4,4,3,5,4,4,5,3,4,4,4,4,5,3,4,4,3,4

## ADDED Requirements

### Requirement: Conversion des photos déjà stockées
Au démarrage, le système SHALL convertir en WebP chaque photo d'import ou de round encore stockée dans un autre format, faire pointer l'import et le round vers le WebP, puis supprimer l'ancien fichier. Une conversion déjà faite MUST NOT être refaite. Une photo qui ne peut pas être convertie MUST rester en place, toujours affichée, sans empêcher le démarrage.

#### Scenario: Photo JPEG d'un round existant
- **WHEN** le serveur démarre avec un round importé dont la photo est un fichier JPEG
- **THEN** le détail du round affiche la photo servie en `image/webp`, et le fichier JPEG n'existe plus sur le serveur

#### Scenario: Deuxième démarrage
- **WHEN** le serveur redémarre après avoir converti toutes les photos
- **THEN** aucune photo n'est reconvertie et chaque round et import affiche toujours sa photo

#### Scenario: Fichier illisible
- **WHEN** le serveur démarre et qu'une photo JPEG stockée est corrompue
- **THEN** le serveur démarre, les autres photos sont converties, et l'import concerné garde son fichier JPEG d'origine
