# Proposal

## Why

Plusieurs attentes de l'app ne montrent rien, ou seulement un bouton grisé. Après le choix d'une photo, le décodage et la réduction à 3000 px prennent une à deux secondes sur téléphone sans aucun signe. « Valider le cadrage », « Lancer la lecture » et « Enregistrer » se grisent sans dire ce qui se passe. Dans la liste des imports, « En attente » et « Lecture en cours » sont des badges fixes : on ne voit pas que la page se met à jour toute seule. Manu veut un indicateur animé, discret et cohérent partout, avec les orbes pointillées de thinking-orbs.

## What Changes

- Un indicateur d'attente commun : une petite orbe animée suivie d'un texte court (« Préparation de la photo… », « Envoi de la photo… »). Le texte est annoncé aux lecteurs d'écran. Avec « réduire les animations » activé, l'orbe reste fixe.
- Il apparaît à chaque attente de l'app :
  - **Import** : préparation de la photo après le choix du fichier (aujourd'hui sans indicateur), redressement de l'aperçu après « Valider le cadrage », envoi après « Lancer la lecture », envoi du recadrage d'un import en échec.
  - **Liste des imports** : devant le badge des imports « En attente » et « Lecture en cours ». La lecture comprend la complétion par l'IA quand elle a lieu : il n'y a pas d'état séparé.
  - **Écran de correction** (import, saisie manuelle, correction d'un round) : enregistrement du round, création d'un joueur depuis une ligne.
  - **Ailleurs** : ouverture de session, ajout et renommage d'un joueur, suppression d'un round.
- Les boutons restent désactivés pendant l'attente, comme aujourd'hui. Les libellés au repos ne changent pas.
- Nouvelle dépendance `thinking-orbs` (MIT), en version exacte.

## Capabilities

### New Capabilities

- `loading-feedback` : retour visuel et annoncé de toute attente de l'utilisateur dans l'app (forme de l'indicateur, accessibilité, mouvement réduit, endroits couverts).

### Modified Capabilities

Aucune. Les états d'import (« En attente », « Lecture en cours »…) de `scorecard-import` gardent leurs libellés ; seul l'indicateur s'ajoute.

## Impact

- **Code** :
  - Nouveau composant client `src/components/ui/pending.tsx` (orbe + texte, `role="status"`), seul endroit qui importe `thinking-orbs`.
  - `src/components/import/` : `import-flow.tsx`, `crop-steps.tsx`, `recrop-import.tsx`, `import-list.tsx`.
  - `src/components/round-editor/` : `round-editor.tsx`, `line-players.tsx`.
  - `src/app/login/login-form.tsx`, `src/components/players/inline-form.tsx`, `src/components/rounds/delete-round.tsx`.
- **Dépendance** : `thinking-orbs@0.3.2` (MIT, 2D canvas, pas de dépendance transitive, `react` en peer). `pnpm check:pins` doit rester vert.
- **Ordre** : indépendant des autres changes. Si `add-correction-autosave` est fusionné avant, son état « Enregistrement… » prend aussi l'orbe (tâche 5.3).
- **Hors périmètre** : un état « Complétion IA en cours » distinct dans la liste des imports, et un écran de chargement entre deux pages (`loading.tsx`). Voir `design.md`.
