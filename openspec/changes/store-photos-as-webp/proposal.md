# Proposal

## Why

Le serveur garde chaque photo de carte telle que le navigateur l'envoie : un JPEG qualité 0,92 jusqu'à 3000 px, écrit sous `DATA_DIR/uploads/<uuid>.jpg`. Ces fichiers pèsent lourd sur le volume de données alors qu'ils servent seulement à la lecture OCR et à l'affichage. Le WebP donne une image de même usage pour une fraction de la taille. Les photos déjà sur le serveur doivent suivre, et leurs JPEG doivent disparaître.

## What Changes

- À l'envoi d'une photo, le serveur la convertit en WebP (avec perte, qualité 90) avant de l'écrire, sous `uploads/<uuid>.webp`. Le fichier reçu n'est jamais écrit sur le disque.
- La lecture OCR en tâche de fond lit ce WebP. La photo de référence `IMG_3064` doit donner la même lecture qu'avant.
- Les routes qui servent la photo d'un import et d'un round renvoient le bon type (`image/webp`), déduit de l'extension du fichier.
- Les photos JPEG déjà stockées sont converties en WebP une fois, au démarrage du serveur web : chaque fichier est converti, les chemins enregistrés pour les imports et les rounds sont mis à jour, puis le JPEG est supprimé. Relancer la conversion ne fait rien de plus.
- Le navigateur continue d'envoyer un JPEG réduit à 3000 px ; rien ne change côté écran.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `scorecard-import` : la requirement « Conservation de la photo » précise que la photo est gardée en WebP et que le fichier envoyé n'est pas conservé ; une nouvelle requirement couvre la conversion des photos déjà stockées.

## Impact

- **Code** : `src/jobs/imports.ts` (`createImport` convertit avant d'écrire), `src/lib/photo-response.ts` (type selon l'extension), nouveau module de conversion des photos existantes lancé sans attente depuis `register()` dans `src/instrumentation.ts`.
- **Données** : colonnes `imports.photo_path` et `rounds.photo_path` réécrites de `.jpg` en `.webp` ; aucun changement de schéma. Fichiers du volume `DATA_DIR/uploads` remplacés.
- **Dépendances** : aucune nouvelle ; `sharp` est déjà utilisé côté serveur et marqué externe pour le worker.
- **Retour arrière** : une version antérieure sait encore lire les `.webp` (sharp décode le WebP) mais les sert en `image/jpeg` ; les JPEG supprimés ne reviennent pas.
