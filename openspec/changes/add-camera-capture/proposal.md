# Proposal

## Why

Pour importer une carte, Manu prend la photo de l'écran du simulateur avec l'appareil photo de l'iPhone, revient dans l'app, touche « Photo de la carte », choisit « Photothèque » et retrouve la photo. Sur iPhone, le champ actuel propose déjà « Prendre une photo » dans son menu, mais il faut le savoir et passer par ce menu à chaque carte. Il veut un bouton qui ouvre directement l'appareil photo depuis l'écran d'import.

## What Changes

- Sur téléphone et tablette, l'écran d'import affiche un bouton « Prendre une photo » qui ouvre directement l'appareil photo arrière.
- La photo prise suit exactement le chemin d'une photo choisie : préparation, cadrage des 4 coins, aperçu redressé, mise en file. Un format illisible donne le même message qu'aujourd'hui.
- Le choix d'un fichier (« Photo de la carte ») reste disponible à côté, pour les photos déjà prises et sur ordinateur.
- Sur un appareil sans écran tactile (ordinateur), le bouton n'apparaît pas : il n'y ouvrirait qu'un sélecteur de fichiers de plus.
- Annuler la prise de vue ne change rien à l'écran.
- Pas d'aperçu caméra en direct dans la page : l'app passe la main à l'appareil photo du téléphone (voir `design.md`).

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `scorecard-import` : nouvelle exigence « Prise de photo depuis l'app ». « Envoi d'une photo » ne change pas : elle couvre déjà une photo « prise au téléphone ou choisie dans les fichiers ».

## Impact

- **Ordre** : ce change s'appuie sur `add-golf-handicap-tracker` (spec `scorecard-import`), qui doit être archivé avant celui-ci.
- **Code** : `src/components/import/import-flow.tsx` (deuxième champ fichier avec `capture="environment"`, même fonction `choose`). Aucune route, aucune donnée, aucun changement côté serveur ou worker.
- **E2e** : nouveau `tests/e2e/camera-capture.spec.ts`, ajouté au projet WebKit iPhone ; `import-photo.spec.ts` et le helper `choosePhoto` gardent le champ « Photo de la carte ».
- **Dépendance** : aucune.
- **Lien** : si `add-thinking-orb-loaders` est fusionné, la photo prise affiche « Préparation de la photo… » comme une photo choisie, sans travail en plus (même fonction `choose`).
