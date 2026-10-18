# Proposal

## Why

Sur l'écran « Vérifier la carte », un rechargement fait tout perdre. La page se reconstruit à partir de `imports.draft`, la lecture brute : les joueurs choisis reviennent à « Choisir un joueur », la date retombe sur celle du jour, les cases corrigées reprennent la valeur lue et les marques de l'IA réapparaissent. Manu corrige souvent sur son téléphone, où un rechargement arrive vite (onglet purgé par iOS, appli remise au premier plan, réseau qui coupe). Il veut pouvoir recharger sans rien perdre.

## What Changes

- Chaque modification de l'écran de correction d'un import s'enregistre sur le serveur, environ 1 s après la dernière frappe, sans bouton. Un enregistrement part aussi quand la page passe en arrière-plan ou se ferme.
- L'état enregistré est complet : parcours, tees, date, toutes les cases de la grille, les lignes de joueur avec le joueur choisi, et les cases encore marquées IA.
- À l'ouverture de `/imports/[id]`, l'écran reprend cet état s'il existe, sinon il part de la lecture comme aujourd'hui. Comme l'état vit sur la ligne de l'import, on le retrouve après un rechargement, sur un autre appareil (téléphone puis ordinateur) ou quand un autre membre du groupe ouvre le même import.
- Un indicateur discret, annoncé aux lecteurs d'écran, dit « Enregistrement… », « Enregistré » ou « Modifications non enregistrées ». Un échec n'empêche jamais de continuer à corriger.
- Un recadrage relance la lecture : la nouvelle lecture remplace les corrections enregistrées, et l'écran de recadrage le dit.
- Une fois le round enregistré, l'import ne prend plus de corrections. Rien ne change pour l'enregistrement du round lui-même.
- La lecture OCR (`imports.draft`) reste intacte. On garde la lecture d'origine à côté des corrections.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `scorecard-import` : nouvelles exigences sur la sauvegarde automatique de l'écran de correction d'un import, sa reprise à l'ouverture, l'indicateur d'enregistrement, et le remplacement par une nouvelle lecture après recadrage.
- `scorecard-ai-completion` : l'exigence « Marquage des cases complétées par l'IA » précise qu'une case modifiée à la main reste sans marque après un rechargement.

`players` et `rounds` ne changent pas. L'association joueur d'une ligne est déjà une valeur de l'écran de correction, et l'apprentissage des alias se fait toujours à l'enregistrement du round, à partir du nom lu que la ligne garde.

## Impact

- **Ordre** : ce change s'appuie sur `add-golf-handicap-tracker` (spec `scorecard-import`) et sur `add-ai-vision-fallback` (PR #7, spec `scorecard-ai-completion` et colonne `imports.ai_cells`). Les deux doivent être fusionnés et archivés avant d'archiver celui-ci.
- **Code** :
  - `src/components/round-editor/` : conversion de l'état de l'éditeur vers sa forme enregistrée et retour, sauvegarde différée, indicateur.
  - `src/app/(app)/imports/[id]/page.tsx` : reprise de l'état enregistré.
  - Nouvelle route `PUT /api/imports/[id]/correction`.
  - `src/jobs/imports.ts` : le recadrage efface la correction enregistrée.
  - `src/server/rounds/http.ts` : le schéma zod du formulaire passe dans un module partagé, pour ne pas le dupliquer.
  - Écran de recadrage : avertissement quand une correction est enregistrée.
- **Base** : colonne `imports.correction` (JSON, nullable). Migration additive.
- **Hors périmètre** : la saisie manuelle (`/rounds/new`) et la correction d'un round enregistré (`/rounds/[id]/edit`). Voir `design.md`.
- **Dépendance** : aucune nouvelle.
