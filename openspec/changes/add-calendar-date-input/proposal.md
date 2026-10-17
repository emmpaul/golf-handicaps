# Proposal

## Why

La date de l'écran de correction est un `<input type="date">` natif. Son rendu dépend du navigateur : sur ordinateur, Chrome affiche « 2026-10-17 » ou « 17/10/2026 » selon la langue du système et un petit calendrier anglais ou français selon le cas ; Safari sur Mac affiche des segments à taper un par un. Manu veut un vrai calendrier, en français, au même style que le reste de l'app (shadcn), qui montre la date en toutes lettres (« 17 octobre 2026 ») comme les pages des rounds.

## What Changes

- Le champ « Date » de l'écran de correction devient un bouton qui affiche la date en toutes lettres (« 17 octobre 2026 ») et ouvre un calendrier dans une fenêtre flottante.
- Le calendrier est en français, la semaine commence le lundi, il s'ouvre sur le mois de la date affichée avec ce jour sélectionné, et propose un choix rapide du mois et de l'année.
- Choisir un jour ferme le calendrier et remplace la date. Échap ferme sans rien changer. Le calendrier se pilote au clavier.
- Sur téléphone, les jours font au moins 44 px et le calendrier tient dans l'écran sans défilement horizontal.
- Rien ne change pour la valeur : la date reste une chaîne ISO `YYYY-MM-DD` dans l'état de l'éditeur, l'API et la base. La marque « complété par l'IA » et le surlignage d'erreur s'appliquent au bouton comme avant au champ.
- S'applique aux trois usages de l'écran : import, saisie manuelle (`/rounds/new`) et correction d'un round (`/rounds/[id]/edit`).
- Les e2e qui remplissent ou lisent la date passent par le calendrier.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `scorecard-import` : trois nouvelles exigences sur l'écran de correction : « Choix de la date au calendrier », « Calendrier utilisable au clavier et au doigt » et « Marques sur le champ de date ». « Correction manuelle avant enregistrement » ne change pas : la date reste modifiable, seule la manière de la choisir est précisée.

## Impact

- **Ordre** : ce change s'appuie sur `add-golf-handicap-tracker` (spec `scorecard-import`), qui doit être archivé avant celui-ci.
- **Code** :
  - `src/components/ui/calendar.tsx` et `src/components/ui/popover.tsx` ajoutés par le CLI shadcn (style `base-nova`, primitives `@base-ui/react`).
  - Nouveau `src/components/round-editor/date-field.tsx` ; `round-editor.tsx` le prend à la place de l'`Input` `type="date"`.
  - Conversion ISO ↔ date locale dans `src/lib/format.ts`, à côté de `formatPlayedOn`.
  - E2e : `tests/e2e/editor.ts` (helper `pickDate`), `manual-entry.spec.ts`, `correction.spec.ts`.
- **Dépendances** : `react-day-picker@10.0.2` et `date-fns@4.4.0`, en versions exactes. `@date-fns/tz` arrive en dépendance transitive de `react-day-picker`.
- **Coordination** : `add-correction-autosave` prévoit un e2e qui remplit la date au clavier ; celui des deux qui arrive en second adapte ce test au helper `pickDate`.
