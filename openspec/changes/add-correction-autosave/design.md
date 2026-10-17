# Design

## Context

Motivation : voir `proposal.md`. Comportements : voir `specs/`.

État actuel, après `add-golf-handicap-tracker` et `add-ai-vision-fallback` :
- `/imports/[id]` (`src/app/(app)/imports/[id]/page.tsx`) construit l'état initial de l'éditeur à chaque rendu : `formFromDraft(db, draft)` associe les lignes par nom ou alias, la date manquante devient `todayIso()`, et `readEditorState(form, true, row.aiCells)` pose les marques IA. Sans brouillon (import en « Échec »), c'est `emptyEditorState(today)`. Un import déjà lié à un round redirige vers ce round.
- `RoundEditor` garde tout dans un `useState<EditorState>` : `form` (parcours, tees, date, par, index, distance), `readCardTotals`, `lines` (nom lu, `playerId`, scores, `readTotals`, et une `key` locale) et `aiCells`. Rien ne part au serveur avant le clic sur « Enregistrer ». Les changements passent par `change(next)`, sauf `associate`, qui fait un `setState` fonctionnel parce qu'il est aussi appelé après la création asynchrone d'un joueur.
- `POST /api/rounds` (`postRound`) valide le formulaire avec un schéma zod local à `src/server/rounds/http.ts`, enregistre le round et, avec `importId`, écrit `imports.round_id`.
- Le recadrage (`recropImport`) n'existe que pour un import en « Échec » : nouveaux coins, statut « En attente », nouveau job, dans une transaction. Il n'a pas d'écran de confirmation.
- Le proxy répond 401 à toute route `/api/*` sans session.
- Les joueurs se créent et se renomment, ils ne se suppriment pas.

Contraintes de Manu :
- Sauvegarde côté serveur, sur la ligne de l'import, pas dans `localStorage`. Elle doit survivre au rechargement, au passage du téléphone à l'ordinateur et à l'ouverture par un autre membre.
- Un change et une PR à part, après #7.
- TDD et jscpd à 0 %, comme pour tout le projet.

## Goals / Non-Goals

**Goals :**
- Un rechargement de `/imports/[id]` rend exactement l'écran laissé : mêmes valeurs, mêmes joueurs, mêmes marques IA.
- La sauvegarde ne gêne jamais la saisie : pas de bouton, pas de blocage, pas de perte de focus.

**Non-Goals :**
- `/rounds/new` (saisie manuelle). Aucune ligne n'existe en base avant l'enregistrement, donc rien à quoi rattacher l'état. Il faudrait une table de brouillons avec son nettoyage, ou `localStorage`, que Manu a écarté pour l'import. À traiter dans un autre change si le besoin se présente.
- `/rounds/[id]/edit`. Le round existe, mais l'enregistrer en cours de saisie écrirait un round incohérent, ce que la spec « Enregistrement bloqué tant que la carte est incohérente » interdit. Il faudrait une colonne de correction en attente sur `rounds`. Hors périmètre.
- Une synchronisation en direct entre deux écrans ouverts sur le même import.
- Un historique ou une annulation des corrections.

## Decisions

### 1. Nouvelle colonne `imports.correction`, `draft` intact
Migration additive : `imports.correction`, JSON, `null` par défaut. On n'écrase pas `draft`. Il reste la lecture d'origine, utile pour comparer, pour la reprise quand la correction est illisible, et pour `getImportStatus`, que l'écran d'import interroge.
*Alternative* : réécrire `draft` à chaque modification, écartée. On perdrait la lecture, et le format de `draft` (`ScorecardDraft`) ne porte ni `playerId` ni les marques IA.
Le nom `correction` plutôt que `form` : dans le code, `form` désigne déjà un `RoundForm`, et ce qu'on enregistre est l'état de l'éditeur, pas un formulaire de round.

### 2. Format enregistré : l'état de l'éditeur, versionné
```
{ version: 1,
  card: { courseName, tees, playedOn, par, strokeIndex, distance },
  readCardTotals,
  lines: [{ name, playerId, scores, readTotals }],
  aiCells }
```
C'est `EditorState` sans la `key` des lignes, qui est locale à l'onglet et que `newLine` régénère à la reprise. On garde `readCardTotals` et `readTotals` : sans eux, des totaux lus et corrigés à la main seraient recalculés à la reprise et l'écran changerait. On garde aussi le `name` lu de chaque ligne, dont dépend l'apprentissage des alias à l'enregistrement du round.

Deux fonctions pures dans `src/components/round-editor/form-state.ts` : `toSavedCorrection(state)` et `restoreEditorState(saved, players)`. À la reprise, un `playerId` absent de la liste des joueurs redevient `null`. Ça ne doit pas arriver aujourd'hui, mais ça évite d'envoyer une clé étrangère invalide à l'enregistrement du round.

Le schéma zod `savedCorrectionSchema` vit dans un module partagé, `src/scorecard/form-schema.ts`. On y déplace aussi `value`, `holeRow` et le schéma de la carte, aujourd'hui locaux à `src/server/rounds/http.ts`, que `postRound` réutilise. `jscpd` reste donc à 0. Le schéma borne `lines` à `MAX_LINES` (4) et `aiCells` à 100 clés. Il sert deux fois : à l'écriture, où un corps invalide donne 400, et à la lecture, où une correction invalide ou d'une autre `version` est ignorée et la page repart de `draft`.
*Alternative* : enregistrer un `RoundForm`, écartée. Il ne porte ni les marques IA ni `readTotals`.

### 3. Route `PUT /api/imports/[id]/correction`
Le corps est le JSON de la correction enregistrée. La logique vit dans `saveCorrection(db, id, raw)` (`src/server/imports/correction.ts`), testable sans HTTP. La route ne fait que traduire le résultat en réponse :
- 204 : correction écrite ;
- 400 « Requête invalide » : le corps ne passe pas le schéma ;
- 404 « Import introuvable » : identifiant non numérique ou inconnu ;
- 409 « Cette carte est déjà enregistrée » : `round_id` non nul ;
- 409 « Lecture en cours » : statut « En attente » ou « Lecture en cours ». Une correction écrite à ce moment serait de toute façon remplacée par la lecture.

L'écriture est un seul `UPDATE … WHERE id = ? AND round_id IS NULL AND status IN ('ready', 'failed')`. S'il ne touche aucune ligne, une lecture dit pourquoi. SQLite sérialise les écritures, donc une correction ne peut pas passer après l'enregistrement du round qui pose `round_id`. La session est vérifiée par le proxy, comme pour les autres routes `/api/imports`.
*Alternative* : une server action, écartée. L'envoi au moment de `pagehide` a besoin d'une URL simple et de `fetch(…, { keepalive: true })`, et une server action ne se prête pas à cet usage.

### 4. Sauvegarde différée côté client
Un hook `useCorrectionAutosave(importId, state)` dans `src/components/round-editor/autosave.ts`. `RoundEditor` ne l'active que pour `target.kind === "create"` avec un `importId` ; la saisie manuelle et la correction d'un round ne changent pas.
- **Déclencheur** : un effet sur `state`. Il voit toutes les modifications, y compris `associate` après la création d'un joueur. On compare la sérialisation de `toSavedCorrection(state)` à la dernière envoyée, initialisée avec l'état d'ouverture. Ouvrir l'écran n'envoie donc rien.
- **Délai** : 1 000 ms après la dernière modification. Un seul envoi à la fois. Une modification pendant l'envoi déclenche un nouvel envoi à sa fin, avec le dernier état seulement.
- **Sortie de page** : sur `pagehide` et sur `visibilitychange` quand la page devient cachée, envoi immédiat de l'état en attente, avec `keepalive: true`. Le corps fait environ 4 Ko, loin de la limite de 64 Ko de `keepalive`. iOS Safari ne déclenche pas toujours `pagehide` quand on change d'appli, d'où `visibilitychange`.
  *Alternative* : `navigator.sendBeacon`, écartée. Il n'envoie qu'en POST et ne rend pas le statut. Il faudrait une deuxième méthode sur la route pour un seul cas.
- **Échec** : une erreur réseau ou une 5xx fait afficher « Modifications non enregistrées » et relance l'envoi 5 s plus tard, toujours avec le dernier état. Une 409 « Cette carte est déjà enregistrée » arrête la sauvegarde et affiche ce message. Une 400, une 404 ou une 401 (session expirée) arrêtent aussi la sauvegarde, avec « Modifications non enregistrées ». La saisie et le bouton « Enregistrer » restent utilisables dans tous les cas.
- **Enregistrement du round** : `submit` annule l'envoi en attente. Un envoi déjà parti qui arrive après le round reçoit 409, sans effet.

### 5. Indicateur
Un `<p role="status">` près du bouton « Enregistrer », dans la barre collée en bas. `role="status"` vaut `aria-live="polite"`, donc l'annonce ne coupe pas la saisie. Il affiche « Enregistrement… », « Enregistré », « Modifications non enregistrées » ou « Cette carte est déjà enregistrée ». Il reste vide tant que rien n'a changé. Le texte est petit et en couleur atténuée, sauf l'échec, en couleur d'erreur.

### 6. Reprise à l'ouverture
`initialEditorState(db, row, today)` dans `src/server/imports/correction.ts` remplace la construction inline de la page. Une correction valide passe par `restoreEditorState`. Sinon, un `draft` passe par `formFromDraft` et `readEditorState`, comme aujourd'hui. Sinon, l'écran est vide. `aiNote` vient toujours de la ligne : c'est un message sur la lecture, pas une valeur corrigée. La redirection vers le round d'un import enregistré passe avant tout ça et ne change pas.

### 7. Recadrage
`recropImport` met `correction` à `null` dans la même transaction que le changement de statut. Comme `PUT` refuse un import « En attente » ou « Lecture en cours », aucune correction ne peut s'écrire avant la nouvelle lecture. Le worker n'a rien à changer.
La page de recadrage passe `hasCorrection` à `RecropImport`, qui affiche l'avertissement de la spec au-dessus de l'éditeur de coins. Ce n'est pas une boîte de confirmation : l'utilisateur peut toujours revenir à la liste sans valider.

### 8. Après l'enregistrement du round
On laisse `correction` telle quelle. L'import est lié au round, la page redirige vers lui, et `PUT` refuse toute nouvelle correction. L'effacer coûterait une écriture de plus dans `saveRound` pour rien.

### 9. Concurrence : la dernière écriture gagne
Pas de numéro de version ni d'ETag. Deux membres qui corrigent le même import en même temps s'écrasent : la dernière correction reçue gagne, et l'autre écran garde son état local jusqu'à sa prochaine ouverture. Pour un groupe de trois joueurs qui importent quelques cartes par semaine, le cas est rare. Une détection de conflit demanderait un écran pour le résoudre.

## Risks / Trade-offs

- [iOS tue l'onglet sans envoyer le dernier `keepalive`] → au plus 1 s de saisie perdue, plus `visibilitychange` en plus de `pagehide`. L'e2e WebKit iPhone couvre la fermeture juste après une modification.
- [Deux écrans ouverts s'écrasent] → la dernière écriture gagne (décision 9). On l'accepte et on le dit dans la spec.
- [Le format de l'éditeur change dans un futur change] → le champ `version` et la validation à la lecture : une correction d'un ancien format est ignorée et l'écran repart de la lecture. On perd les corrections en cours, rien d'autre.
- [Une écriture par seconde de saisie] → une petite mise à jour SQLite sur une ligne, négligeable pour quelques utilisateurs.
- [Session expirée en cours de correction] → 401, « Modifications non enregistrées », la saisie continue. Il faut se reconnecter, et le bouton « Enregistrer » échoue de la même façon qu'aujourd'hui.

## Migration Plan

1. Déployer la nouvelle image : la migration additive (`imports.correction`) s'applique au démarrage du web. Le worker n'a rien de nouveau.
2. Les imports existants ont `correction` à `null` et s'ouvrent depuis leur lecture, comme avant.
3. Retour arrière : redéployer le tag précédent. L'ancien code ignore la colonne, et les corrections enregistrées sont perdues pour l'écran.

## Open Questions

- Faut-il prévenir quand un autre membre a enregistré une correction depuis l'ouverture de l'écran (par exemple « Gab a modifié cette carte, recharger ? ») ? Ça demanderait une date de modification et une interrogation régulière. On attend de voir si le cas arrive.
- Le délai de 5 s entre deux essais après un échec suffit-il hors réseau prolongé, ou faut-il un délai croissant ? À régler à l'usage, sans changer la spec.
