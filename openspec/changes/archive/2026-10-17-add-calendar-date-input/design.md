# Design

## Context

Motivation : voir `proposal.md`. Comportements : voir `specs/scorecard-import/spec.md`.

État actuel :
- `RoundEditor` (`src/components/round-editor/round-editor.tsx`) rend parcours, tees et date dans une même boucle d'`Input`, la date en `type="date"`, `id="playedOn"`, libellé « Date ». `setField("playedOn", value)` retire la marque IA (`withoutAiCell`) et écrit `value || null` dans `state.form.playedOn`. Le champ porte `aria-invalid` (date manquante, via `checkRoundForm`) et, si l'IA l'a rempli, `aria-description="complété par l'IA"`, le fond `AI_CELL_CLASS` et `<AiMark />`.
- La date initiale est toujours renseignée : lue sur la carte, sinon `todayIso()` (import), la date du jour (saisie manuelle) ou celle du round (correction).
- `formatPlayedOn` (`src/lib/format.ts`) affiche une date ISO en « 17 octobre 2026 », en lisant la date en UTC : pas de décalage de fuseau.
- `components.json` : style `base-nova`, primitives `@base-ui/react` 1.9.0, icônes lucide, `rsc: true`. `src/components/ui` n'a ni `calendar` ni `popover`. Le CLI `shadcn` 4.22.0 est déjà en dépendance.
- Le registre `base-nova` donne : `popover` sur `@base-ui/react/popover` (pas Radix), et `calendar` sur `react-day-picker` + `date-fns`, avec `button` en dépendance de registre. Le CLI ajoute `react-day-picker@latest` et `date-fns` sans version.
- E2e qui touchent la date : `manual-entry.spec.ts` (`getByLabel("Date").fill("2026-10-17")`) et `correction.spec.ts` (`toHaveValue("2026-10-17")`). `mobile.spec.ts` impose 44 px aux cibles tactiles qu'il contrôle et l'absence de défilement horizontal.
- Contraintes : versions exactes (`.npmrc` `save-exact=true`, `pnpm check:pins`), TDD avec mutation nommée, jscpd à 0 %, pas de bibliothèque de test de composants (l'interface se teste en e2e).

## Goals / Non-Goals

**Goals :**
- Un sélecteur de date au style de l'app, identique sur tous les navigateurs.
- Aucun changement de format de données : `playedOn` reste une chaîne `YYYY-MM-DD` partout.

**Non-Goals :**
- Interdire les dates futures ou trop anciennes. Le champ actuel n'a pas de borne ; en ajouter une changerait les contrôles de cohérence. Voir Open Questions.
- Saisir la date au clavier en texte libre (« 17/10/2026 »). Le calendrier se pilote au clavier ; un champ texte en plus demanderait son propre analyseur et ses propres erreurs.
- Remplacer d'autres champs par des composants shadcn.

## Decisions

### 1. Composants shadcn `calendar` et `popover`, variante `base-nova`
`pnpm exec shadcn add calendar popover`, qui lit `components.json` et prend donc la variante `base-nova` : `Popover` sur `@base-ui/react/popover`, cohérent avec `alert-dialog.tsx` déjà en place. On lance d'abord `--dry-run` : si le CLI veut réécrire `button.tsx` (dépendance de registre de `calendar`), on refuse l'écrasement et on garde le fichier actuel.
Le CLI installe `react-day-picker` et `date-fns` ; avec `save-exact=true`, `package.json` doit recevoir `10.0.2` et `4.4.0`. On le vérifie et on corrige à la main si besoin, puis `pnpm check:pins`. Les deux versions ont plus de deux semaines.
*Alternative* : un calendrier fait main avec `Intl`, écartée. Navigation clavier, grille ARIA et choix du mois sont déjà faits et testés dans `react-day-picker`.
*Alternative* : la variante `radix-nova`, écartée. Elle ajouterait `radix-ui` à côté de `@base-ui/react` pour un seul composant.

### 2. `DateField` : un bouton qui ouvre le calendrier
`src/components/round-editor/date-field.tsx`, `"use client"` :
- `PopoverTrigger` rendu en `Button variant="outline"` pleine largeur, `id="playedOn"` : le `FieldLabel htmlFor="playedOn"` existant le nomme « Date », donc `getByLabel("Date")` trouve le bouton. Texte : `formatPlayedOn(value)`, ou « Choisir une date » si `value` est `null`. Icône `CalendarIcon` de lucide.
- Le bouton reprend `aria-invalid`, `aria-description`, `AI_CELL_CLASS` et `<AiMark />`, comme l'`Input` aujourd'hui.
- `PopoverContent` (largeur auto) contient `Calendar mode="single"` avec `selected` et `defaultMonth` = la date courante, `locale={fr}` (`react-day-picker/locale`, semaine au lundi et libellés français), `captionLayout="dropdown"`, `required`.
- `onSelect(date)` : `onChange(localDateToIso(date))` puis fermeture (popover contrôlé par `open`). Dans `RoundEditor`, `onChange` appelle `setField("playedOn", iso)` : la marque IA tombe comme avant.
- `required` : un clic sur le jour déjà choisi ne vide pas la date. La date initiale est toujours renseignée, donc le problème « date manquante » ne peut plus apparaître depuis l'interface ; il reste vérifié côté contrôles et serveur.

La boucle `{ field, label, type }` de `round-editor.tsx` ne garde que parcours et tees ; la date se rend à part avec `DateField`.

### 3. Conversion sans décalage de fuseau
`react-day-picker` manipule des `Date` locales à minuit. Deux fonctions pures dans `src/lib/format.ts` :
- `isoToLocalDate("2026-10-17")` → `new Date(2026, 9, 17)` ;
- `localDateToIso(date)` → `YYYY-MM-DD` à partir de `getFullYear`, `getMonth`, `getDate`.

`new Date("2026-10-17")` est lu en UTC et donne le 16 au soir à Montréal ; `date.toISOString().slice(0, 10)` donne la veille à Paris. Les tests passent donc par deux fuseaux, fixés avec `process.env.TZ` dans le fichier de test (Node relit la variable) : `America/Toronto` pour la lecture, `Europe/Paris` pour l'écriture.
L'affichage garde `formatPlayedOn`, déjà sûr.

### 4. Bornes et taille du calendrier
- `startMonth` = janvier 2020, `endMonth` = décembre de l'année en cours : la liste des années reste courte et couvre les cartes anciennes qu'on voudrait saisir. Aucun jour n'est désactivé (Non-Goals).
- Le registre fixe `--cell-size` à `--spacing(7)` (28 px). On passe `className="[--cell-size:--spacing(11)]"` (44 px) au `Calendar` dans `DateField` : 7 × 44 px + marges tiennent dans les 393 px d'un iPhone 15. Le fichier `calendar.tsx` du registre reste tel quel.

### 5. E2e
Helper `pickDate(page, iso)` dans `tests/e2e/editor.ts` : clic sur `getByLabel("Date")`, choix du mois et de l'année dans les deux listes déroulantes du calendrier, clic sur le bouton du jour (nom accessible en français, qui contient « 17 octobre 2026 »). Les lectures deviennent `toHaveText("17 octobre 2026")` sur le bouton.
- `manual-entry.spec.ts` : `fill("2026-10-17")` → `pickDate(page, "2026-10-17")`.
- `correction.spec.ts` : `toHaveValue("2026-10-17")` → `toHaveText("17 octobre 2026")`.
- Nouveau `date-picker.spec.ts`, ajouté à `MOBILE_SPECS` pour tourner aussi sur WebKit iPhone.

## Risks / Trade-offs

- [Sur iPhone, la roue native de Safari est familière et le calendrier ajoute une fenêtre] → cases de 44 px, ouverture sur le bon mois ; jugé sur le téléphone en 7.1 (tâches). Voir Open Questions.
- [Le CLI écrase `button.tsx` ou installe des versions non exactes] → `--dry-run` d'abord, `pnpm check:pins` et `git diff src/components/ui/button.tsx` vide en vérification.
- [Les noms accessibles des jours dépendent de la locale de `react-day-picker`] → le helper `pickDate` cible le texte « 17 octobre 2026 » ; si une mise à jour change le format, seul le helper bouge.
- [La fenêtre flottante se place mal dans la barre collée ou en bas d'écran sur téléphone] → le positionnement de `@base-ui/react` retourne la fenêtre au-dessus quand la place manque ; contrôlé par l'e2e iPhone.

## Migration Plan

Rien en base ni dans l'API. Déploiement normal de l'image. Retour arrière : redéployer le tag précédent.

## Open Questions

- Faut-il garder le champ natif sur téléphone (roue iOS) et réserver le calendrier à l'ordinateur ? Le change remplace partout, comme demandé ; à revoir après la tâche 7.1.
- Faut-il interdire les dates futures (un round ne se joue pas demain) ? Ce serait un nouveau contrôle de cohérence, dans un change à part.
- La borne basse de janvier 2020 convient-elle ? À ajuster sans changer la spec.
