# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après les specs. Chaque tâche nomme la mutation qui fait passer son test au rouge. Les données partent de la carte de référence (date lue 2026-10-17). `pnpm jscpd` reste à 0 %, et chaque commit passe commitlint.

## 1. Composants et dépendances

- [ ] 1.1 `pnpm exec shadcn add calendar popover --dry-run`, puis l'ajout réel en refusant l'écrasement de `button.tsx` s'il est proposé. Vérifier : `src/components/ui/calendar.tsx` et `src/components/ui/popover.tsx` existent, `popover.tsx` importe `@base-ui/react/popover`, `git diff src/components/ui/button.tsx` est vide, `package.json` contient `"react-day-picker": "10.0.2"` et `"date-fns": "4.4.0"` sans `^`, `pnpm check:pins` affiche « Toutes les versions sont exactes. », et `pnpm lint` passe sur les deux fichiers ajoutés.

## 2. Conversion de date (spec « Choix de la date au calendrier », scénario « Fuseau horaire à l'ouest de Greenwich »)

- [ ] 2.1 TDD : `isoToLocalDate` et `localDateToIso` dans `src/lib/format.ts`, testées dans `tests/lib/format.test.ts`. Cas :
  - avec `process.env.TZ = "America/Toronto"` : `isoToLocalDate("2026-10-17").getDate()` vaut `17` et `getMonth()` vaut `9` ;
  - avec `process.env.TZ = "Europe/Paris"` : `localDateToIso(new Date(2026, 9, 13))` vaut `"2026-10-13"` ;
  - `localDateToIso(new Date(2025, 2, 4))` vaut `"2025-03-04"` (zéros de tête).

  Mutation : `new Date(iso)` dans `isoToLocalDate` (donne le 16 à Toronto), ou `toISOString().slice(0, 10)` dans `localDateToIso` (donne le 12 à Paris). Vérifier que chaque cas tourne bien dans son fuseau : `new Date(2026, 9, 17).getTimezoneOffset()` vaut `240` à Toronto et `-120` à Paris, assertés en tête de bloc.

## 3. Champ de date (specs « Choix de la date au calendrier », « Marques sur le champ de date »)

- [ ] 3.1 TDD (e2e, `tests/e2e/date-picker.spec.ts`) : `DateField` dans `src/components/round-editor/date-field.tsx`, branché dans `round-editor.tsx` à la place de l'`Input` `type="date"`. Données : `seedReadyImport`. Cas :
  - `getByLabel("Date")` a le texte « 17 octobre 2026 » ;
  - au clic, le calendrier affiche « octobre 2026 », le jour 17 a `aria-selected="true"` (ou l'état sélectionné du bouton) et le premier en-tête de colonne est « lun. » ;
  - clic sur le 13 : le calendrier se ferme et le champ affiche « 13 octobre 2026 » ;
  - choix de mars et 2025 dans les listes, puis du 4 : « 4 mars 2025 ».

  Mutation : ouvrir le calendrier sur le mois courant au lieu de celui de la date (`defaultMonth` absent), ou oublier `locale={fr}`.
- [ ] 3.2 TDD (e2e) : enregistrement. Sur l'import de référence, choisir le 13 puis enregistrer : le round apparaît dans `/rounds` daté « 13 octobre 2026 », et en base `rounds.played_on` vaut `"2026-10-13"`. Mutation : `onChange(date.toISOString().slice(0, 10))` dans `DateField` avec le navigateur en `timezoneId: "Europe/Paris"` (contexte Playwright), qui enregistre le 12.
- [ ] 3.3 TDD (e2e) : fuseau à l'ouest. Contexte Playwright `timezoneId: "America/Toronto"`, round `seedRound` daté `2026-10-17`, page `/rounds/[id]/edit` : le champ affiche « 17 octobre 2026 » et le calendrier sélectionne le 17. Mutation : `selected={new Date(value)}`.
- [ ] 3.4 TDD (e2e) : marque IA. Import avec `aiCells = ["playedOn"]` : le champ « Date » porte la description « complété par l'IA » ; après choix du 13, il ne la porte plus. Données d'erreur : un état sans date n'est plus atteignable par l'interface (design, décision 2), donc pas de test e2e de surlignage ; `aria-invalid` reste couvert par le passage de `invalid.has("playedOn")` au bouton, vérifié en relisant la diff. Mutation : appeler `onChange` sans passer par `setField` (la marque reste).

## 4. Clavier et téléphone (spec « Calendrier utilisable au clavier et au doigt »)

- [ ] 4.1 TDD (e2e) : clavier. Focus sur « Date », Entrée ouvre le calendrier, deux Flèche gauche puis Entrée : le champ affiche « 15 octobre 2026 » et `page.locator(":focus")` est le bouton `#playedOn`. Autre cas : ouvrir puis Échap, le texte reste « 17 octobre 2026 ». Mutation : popover non contrôlé qui ne se ferme pas à la sélection.
- [ ] 4.2 TDD (e2e, WebKit iPhone) : ajouter `date-picker` à `MOBILE_SPECS` dans `playwright.config.ts`. Calendrier ouvert : chaque bouton de jour mesure au moins 44 × 44 px (`boundingBox`), et `document.documentElement.scrollWidth` ≤ `window.innerWidth`. Mutation : retirer `[--cell-size:--spacing(11)]` (les jours retombent à 28 px).

## 5. E2e existants

- [ ] 5.1 Helper `pickDate(page, iso)` dans `tests/e2e/editor.ts` (design, décision 5). Remplacer `getByLabel("Date").fill("2026-10-17")` dans `manual-entry.spec.ts` par `pickDate(page, "2026-10-17")`, et `toHaveValue("2026-10-17")` dans `correction.spec.ts` par `toHaveText("17 octobre 2026")`. Vérifier : `grep -rn 'getByLabel("Date")' tests/e2e` ne montre plus ni `.fill(` ni `toHaveValue(`, et ces deux fichiers passent.

## 6. Vérification d'ensemble

- [ ] 6.1 Passer les contrôles du projet : `pnpm check:pins`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm build`, `docker build`. Vérifier : tout est vert, et `grep -rn 'type: "date"' src` ne trouve rien.

## 7. Vérification réelle (humain)

- [ ] 7.1 Sur le téléphone de Manu et sur l'ordinateur, après déploiement : ouvrir un import, changer la date par le calendrier (même mois, puis un autre mois d'une autre année), enregistrer, puis vérifier la date dans la liste des rounds. Dire si le calendrier convient sur téléphone ou s'il faut garder la roue native (Open Questions du design).

## Workflow follow-up

- Si `add-correction-autosave` est fusionné avant, adapter son test « remplacer la date par 2026-10-13 » à `pickDate(page, "2026-10-13")` dans ce change ; sinon, le signaler dans la PR de `add-correction-autosave`.
- Archiver `add-golf-handicap-tracker` avant d'archiver ce change : la spec `scorecard-import` doit déjà exister dans `openspec/specs/`.
- Archiver ce change (`/opsx:archive`) une fois sa PR fusionnée et la vérification 7.1 validée.
