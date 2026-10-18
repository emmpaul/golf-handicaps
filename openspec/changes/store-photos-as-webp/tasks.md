# Tasks

## 1. Conversion WebP des nouveaux envois

- [ ] 1.1 Ajouter dans `src/jobs/imports.ts` une fonction exportée `toStoredWebp(photo: Buffer): Promise<Buffer>` (`sharp(photo).rotate().webp({ quality: 90 })`) ; test : le buffer rendu commence par `RIFF` et porte `WEBP` aux octets 8 à 11, et un buffer non image rejette. Vérifier : `pnpm test tests/jobs/imports.test.ts`.
- [ ] 1.2 Rendre `createImport` asynchrone : conversion avant écriture, chemin `uploads/<uuid>.webp`, aucun fichier écrit si la conversion échoue. Mettre à jour `tests/jobs/imports.test.ts` avec une vraie petite image JPEG (le faux buffer actuel n'est pas décodable) : chemin attendu `/^uploads\/[0-9a-f-]{36}\.webp$/`, fichier WebP sur le disque, un seul fichier dans `uploads/`, rien dans `uploads/` si le job ne peut pas être créé. Vérifier : test vert, et rouge si on remet l'écriture du buffer brut.
- [ ] 1.3 Dans `src/app/api/imports/route.ts`, attendre `createImport` et répondre 400 « Photo illisible » si la conversion rejette ; test de route qui envoie un blob non image et vérifie le statut 400 et le message exact. Vérifier : `pnpm test`.
- [ ] 1.4 Test de non-régression OCR : passer `gspro-img3064.jpg` par `toStoredWebp`, lire le résultat avec `readScorecard` et les coins de référence, comparer à `gspro-img3064.draft.json` (même assertion que `tests/ocr/read-scorecard.test.ts`). Vérifier : vert à qualité 90 ; noter dans le PR qu'il passe rouge à une qualité nettement plus basse (ex. 20).
- [ ] 1.5 Mettre à jour le commentaire de `createImport` (`uploads/<uuid>.webp`) et celui de `POST /api/imports`. Vérifier : `pnpm lint` et `pnpm typecheck` verts.

## 2. Type de la photo servie

- [ ] 2.1 `photoResponse` choisit `image/webp` pour `.webp` et `image/jpeg` pour `.jpg`/`.jpeg` ; tests dans `tests/lib/` avec un fichier de chaque extension sous un `DATA_DIR` temporaire, assertion exacte du header `content-type`. Vérifier : rouge si le type reste codé en dur.

## 3. Conversion des photos déjà stockées

- [ ] 3.1 Créer `src/jobs/convert-photos.ts` avec `convertStoredPhotos(db, dataDir): Promise<{ converted: number; failed: string[] }>` selon le design (décision 4) : chemins distincts non `.webp` des tables `imports` et `rounds`, écriture du WebP, mise à jour des deux tables dans une transaction, suppression de l'ancien fichier après commit, fichier absent ou illisible laissé en place.
- [ ] 3.2 Tests dans `tests/jobs/convert-photos.test.ts` : (a) un import et le round qui partage sa photo JPEG → les deux lignes pointent vers le même `.webp`, le `.jpg` n'existe plus, résultat `{ converted: 1, failed: [] }` ; (b) second appel → `{ converted: 0, failed: [] }` et fichiers inchangés ; (c) un JPEG corrompu et un JPEG valide → le valide est converti, le corrompu garde son chemin et son fichier, `failed` vaut le chemin du corrompu, aucun `.webp` orphelin ; (d) un `.webp` déjà présent n'est pas touché. Vérifier : chaque test rouge en retirant respectivement la mise à jour de `rounds`, le filtre `.webp`, le `try/catch` par fichier.
- [ ] 3.3 Lancer `convertStoredPhotos` depuis `register()` (`src/instrumentation.ts`) après `prepareDatabase`, sans l'attendre, avec une ligne de journal en fin (`Photos converties en WebP : N, échecs : M`) et une erreur journalisée si la promesse rejette. Vérifier : `pnpm dev` sur un `DATA_DIR` contenant un import JPEG → la ligne apparaît, le fichier devient `.webp`, la photo s'affiche dans l'import.

## 4. Vérification d'ensemble

- [ ] 4.1 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm jscpd` et `pnpm build` verts (le bundle du worker garde `sharp` en externe).
- [ ] 4.2 E2E existants (`pnpm e2e`) verts ; dans le parcours d'import, la requête de la photo de l'import répond `content-type: image/webp`.
- [ ] 4.3 Essai manuel sur téléphone : import d'une photo HEIC/JPEG, lecture « Prêt à vérifier », photo visible sur l'écran de correction puis dans le détail du round enregistré.

## Workflow follow-up

- Après déploiement, lire la ligne de fin de conversion dans les journaux du web et vérifier qu'il ne reste aucun `.jpg` dans `DATA_DIR/uploads` hors échecs signalés.
- Archiver le change une fois le PR mergé.
