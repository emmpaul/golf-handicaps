# Design

## Context

- Le navigateur décode la photo, la réduit à 3000 px sur le grand côté et l'envoie en JPEG qualité 0,92 (`src/components/import/decode-photo.ts`).
- `POST /api/imports` passe le buffer à `createImport` (`src/jobs/imports.ts`), qui l'écrit tel quel sous `DATA_DIR/uploads/<uuid>.jpg`, puis crée l'import et son job `ocr-scorecard` dans une transaction (le fichier est supprimé si la transaction échoue).
- Le worker relit ce fichier (`src/jobs/ocr-scorecard.ts`) et le décode avec `sharp` (`decodeGray` : `rotate()`, niveaux de gris).
- À l'enregistrement d'un round depuis un import, `rounds.photo_path` reçoit le même chemin que `imports.photo_path` (`src/server/rounds/save.ts`) : un fichier peut être référencé par les deux tables.
- `photoResponse` (`src/lib/photo-response.ts`) sert tout fichier en `image/jpeg`.
- Le web applique les migrations au démarrage (`register()` dans `src/instrumentation.ts` → `prepareDatabase`) ; le worker attend qu'elles soient en base.

## Goals / Non-Goals

**Goals:**
- Un seul fichier par photo sur le disque, en WebP, pour les nouveaux envois comme pour les anciens.
- Aucun changement de lecture OCR sur la carte de référence.

**Non-Goals:**
- Changer l'encodage côté navigateur (JPEG reste le format d'envoi : `canvas.toBlob("image/webp")` n'est pas pris en charge par Safari iOS).
- Réduire encore la définition (les 3000 px restent : l'OCR en a besoin).
- Convertir l'aperçu redressé ou le panneau envoyé à l'IA : ils ne sont pas stockés.

## Decisions

### 1. Conversion côté serveur dans `createImport`, avant l'écriture

`createImport` devient asynchrone : `sharp(photo).rotate().webp({ quality: 90 }).toBuffer()`, puis écriture de `uploads/<uuid>.webp`. Le buffer reçu ne touche jamais le disque.

- `rotate()` applique l'orientation EXIF avant de la perdre : le WebP de sharp n'emporte pas les métadonnées par défaut, et les coins sont exprimés dans l'image telle qu'affichée. Le canvas du navigateur produit déjà une image droite ; c'est une garantie pour les clients qui enverraient un JPEG brut.
- Un buffer que sharp ne sait pas décoder fait échouer l'envoi (400 « Photo illisible ») au lieu de créer un import voué à l'échec.
- Alternative écartée : convertir dans le worker après la lecture OCR. Le JPEG resterait sur le disque jusqu'au passage du job, et un job en échec le garderait indéfiniment.
- Alternative écartée : WebP sans perte. Fichier souvent plus gros que le JPEG reçu, ce qui va contre le but.

### 2. Qualité 90, gardée par le test de référence

Le test d'intégration de lecture (`tests/ocr/read-scorecard.test.ts`) lit aujourd'hui `gspro-img3064.jpg`. Un nouveau test passe ce JPEG par la même conversion que `createImport` (fonction exportée, pas une copie des paramètres) puis compare la lecture au brouillon attendu `gspro-img3064.draft.json`. Si la qualité 90 dégrade la lecture, ce test casse avant la mise en prod.

### 3. Type servi déduit de l'extension

`photoResponse` choisit le `content-type` selon l'extension du chemin stocké : `.webp` → `image/webp`, `.jpg`/`.jpeg` → `image/jpeg`. Les JPEG qu'on n'a pas pu convertir (décision 4) restent donc servis correctement. Pas de détection par octets magiques : le chemin vient de la base, que le serveur écrit lui-même.

### 4. Conversion des photos existantes au démarrage du web, en arrière-plan

Nouveau module `src/jobs/convert-photos.ts`, `convertStoredPhotos(db, dataDir)` :

1. Liste les chemins distincts qui ne finissent pas par `.webp`, dans `imports.photo_path` et `rounds.photo_path`.
2. Pour chacun : lit le fichier, le convertit (même fonction que décision 1), écrit `<même uuid>.webp`, puis dans une transaction met à jour toutes les lignes `imports` et `rounds` qui pointaient vers l'ancien chemin. Après le commit seulement, supprime l'ancien fichier.
3. Fichier absent ou illisible : journalise un avertissement, retire le `.webp` éventuellement écrit, laisse la ligne et le fichier d'origine, passe au suivant.

`register()` lance `convertStoredPhotos` après `prepareDatabase`, sans l'attendre, et journalise le nombre converti et les échecs. Le web répond pendant la conversion.

- Idempotent par construction : une fois les chemins en `.webp`, l'étape 1 ne trouve plus rien. Un arrêt entre l'écriture du WebP et le commit laisse un `.webp` orphelin que le passage suivant réécrit (même nom).
- Alternative écartée : migration drizzle. Les migrations sont du SQL synchrone ; la conversion touche des fichiers et sharp est asynchrone.
- Alternative écartée : script lancé à la main. Il faudrait se souvenir de l'exécuter dans le conteneur ; le démarrage le fait à chaque déploiement sans action.
- Alternative écartée : attendre la conversion avant de servir. Sur un volume de quelques centaines de photos, le démarrage prendrait des dizaines de secondes pour rien.

## Risks / Trade-offs

- [Le worker lit une photo pendant sa conversion : il a lu l'ancien chemin, le fichier est supprimé avant qu'il l'ouvre] → `readFile` échoue, le job est retenté (`MAX_ATTEMPTS`) et relit la ligne, qui pointe alors vers le WebP. Fenêtre de quelques millisecondes, une seule fois par photo.
- [Une page affichée pendant la conversion demande l'ancien chemin] → La route relit le chemin en base à chaque requête ; au pire un 404 ponctuel, résolu au rechargement.
- [Qualité 90 trop basse pour une autre carte que la référence] → Le test de référence couvre la mise en page GSPro, la seule lue par l'OCR. L'IA de repli et la correction manuelle restent là.
- [Retour arrière vers une version antérieure] → Elle lit les `.webp` (sharp les décode) mais les sert en `image/jpeg` ; les navigateurs les affichent quand même par détection du contenu. Les JPEG supprimés ne sont pas récupérables : la sauvegarde du volume est le seul filet.

## Migration Plan

1. Déployer : au premier démarrage, les nouveaux envois sont en WebP et la conversion des anciens tourne en arrière-plan.
2. Vérifier dans les journaux du web la ligne de fin de conversion (nombre converti, nombre en échec), puis qu'aucun `.jpg` ne reste dans `DATA_DIR/uploads` hors échecs signalés.
3. Retour arrière : redéployer la version précédente ; voir le risque ci-dessus.
