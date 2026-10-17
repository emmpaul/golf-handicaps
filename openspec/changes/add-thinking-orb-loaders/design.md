# Design

## Context

Motivation : voir `proposal.md`. Comportements : voir `specs/loading-feedback/spec.md`.

Attentes relevées dans le code actuel :

| Endroit | Fichier | Aujourd'hui |
|---|---|---|
| Préparation de la photo (`decodePhoto`) | `src/components/import/import-flow.tsx` (`choose`) | rien, l'écran ne bouge pas |
| Aperçu redressé (`rectifyPreview`) | `src/components/import/crop-steps.tsx` (`busy`) | boutons grisés |
| Envoi de la photo (`POST /api/imports`) | `crop-steps.tsx` → `import-flow.tsx` (`launch`) | boutons grisés |
| Envoi du recadrage (`POST /api/imports/[id]/corners`) | `src/components/import/recrop-import.tsx` via `CropSteps` | boutons grisés |
| Imports « En attente » / « Lecture en cours » | `src/components/import/import-list.tsx` (interrogation toutes les 2 s) | badge fixe |
| Enregistrement du round | `src/components/round-editor/round-editor.tsx` (`saving`) | bouton grisé ; `finally` le réactive juste après `router.push`, pendant la navigation |
| Création d'un joueur depuis une ligne | `src/components/round-editor/line-players.tsx` (`pending`) | bouton « Créer » grisé |
| Ouverture de session | `src/app/login/login-form.tsx` (`useActionState`) | bouton grisé |
| Ajout / renommage d'un joueur | `src/components/players/inline-form.tsx` (`useActionState`) | bouton grisé |
| Suppression d'un round | `src/components/rounds/delete-round.tsx` (`deleting`) | bouton grisé |

La complétion par l'IA se fait dans le worker, pendant « Lecture en cours ». Elle n'a pas d'état à elle côté interface.

Aucun `loading.tsx` dans `src/app`. Aucune attente n'utilise `role="status"`. L'app n'a pas de mode sombre actif : la variante `dark` de `globals.css` dépend d'une classe `.dark` que rien ne pose.

Bibliothèque `thinking-orbs` (lue dans le dépôt et le paquet npm 0.3.2) :
- paquet npm, licence MIT, composant React `ThinkingOrb` qui dessine sur un `<canvas>` 2D ; `react >= 18` en peer, aucune dépendance ;
- props : `state` (9 animations : `working`, `searching`, `solving`, `listening`, `connecting`, `weaving`, `composing`, `breathing`, `shaping`), `size` (`20`, `32`, `64`), `theme` (`auto`, `light`, `dark`), `paused`, `speed`, `color` ; les autres props passent au `<canvas>` après `role` et `aria-label`, donc on peut les remplacer ;
- rend `role="img"` avec un `aria-label` anglais par défaut (« Working… ») ;
- `prefers-reduced-motion: reduce` : une seule image fixe ;
- se met en pause hors écran (`IntersectionObserver`) et onglet caché ;
- le `dist` n'a pas de directive `"use client"` : il faut l'importer depuis un composant client ;
- `theme="auto"` regarde d'abord une classe `dark`/`light` sur un ancêtre, sinon `prefers-color-scheme`.

Contraintes du projet : versions exactes (`.npmrc` `save-exact=true`, `pnpm check:pins` en CI), TDD avec mutation nommée, `pnpm jscpd` à 0 %, e2e Chromium et WebKit iPhone. Pas de bibliothèque de test de composants : le comportement de l'interface se teste en e2e.

## Goals / Non-Goals

**Goals :**
- Un seul composant d'attente, utilisé partout, pour que le texte, l'annonce et l'orbe ne divergent pas.
- Aucune attente silencieuse parmi celles du tableau.

**Non-Goals :**
- Un état « Complétion IA en cours » dans la liste des imports. Il faudrait un nouveau statut d'import écrit par le worker, donc toucher `scorecard-import` et la base. Voir Open Questions.
- Un écran de chargement entre deux pages (`src/app/(app)/loading.tsx`). Les pages lisent SQLite en local et s'affichent vite ; un fond de chargement ferait clignoter chaque navigation. Voir Open Questions.
- Le mode sombre.

## Decisions

### 1. Paquet npm, pas de copie du code
`pnpm add thinking-orbs@0.3.2`, version exacte (publiée le 22/09/2026, plus de trois semaines avant ce change). La bibliothèque fait environ 25 Ko, sans dépendance, et se met à jour par une PR comme le reste.
*Alternative* : copier `src/` dans le projet, écartée. On perdrait les correctifs, il faudrait faire passer Biome et jscpd sur un moteur de dessin qu'on ne maintient pas, et la licence MIT impose de garder la notice.

### 2. Un composant `Pending` qui seul importe la bibliothèque
`src/components/ui/pending.tsx`, `"use client"` :
```tsx
<Pending label={busy ? "Envoi de la photo…" : null} orb="send" />
// pendant l'attente, rend :
<span role="status" class="inline-flex items-center gap-2 text-sm text-muted-foreground">
  <ThinkingOrb state="working" size={20} theme="light" aria-hidden role="presentation" />
  <span>Envoi de la photo…</span>
</span>
// au repos (`label={null}`), rend :
<span role="status" class="sr-only"></span>
```
- Le texte visible porte l'annonce, via `role="status"` (équivaut à `aria-live="polite"`). L'orbe est décorative : `aria-hidden`, ce qui écarte le libellé anglais par défaut.
- La région `role="status"` est toujours montée, vide au repos, comme l'indicateur de la sauvegarde automatique : seul son contenu change au début et à la fin de l'attente. Un lecteur d'écran (VoiceOver surtout) n'annonce pas toujours une région insérée déjà remplie. Vide, elle est `sr-only` : hors du flux, elle n'ajoute ni espace (`gap`) ni décalage.
- Une variante `PendingOrb` (orbe seule, `aria-hidden`) sert là où un texte existe déjà, comme le badge de la liste des imports.
- `size={20}` partout : c'est le format prévu pour une ligne de texte.
- `theme="light"` fixé : l'app est toujours claire, mais `auto` suivrait `prefers-color-scheme` et dessinerait des points clairs sur fond clair sur un téléphone en mode sombre. À revoir avec un éventuel mode sombre.
*Alternative* : monter `<Pending>` seulement pendant l'attente (`{busy ? <Pending …/> : null}`), écartée pour la raison ci-dessus : la région arriverait déjà remplie.
*Alternative* : passer `aria-label` en français à l'orbe et la laisser en `role="img"`, écartée. Une image n'est pas une région annoncée : le lecteur d'écran ne dirait rien quand elle apparaît.

### 3. Une animation par type d'attente
Dans `pending.tsx`, une table `ORB_FOR` qui associe le type d'attente à l'animation :
- `queued` (« En attente ») → `breathing`, un anneau qui respire : on attend son tour ;
- `reading` (« Lecture en cours ») → `searching`, un balayage de globe : on lit la carte ;
- `rectify` (« Redressement de la photo… ») → `shaping`, contour qui passe du cercle au carré : la photo devient rectangle ;
- `prepare`, `send`, `save` (préparation, envois, enregistrements, connexion, suppression) → `working`.

`orbForImport(status)` renvoie l'animation d'un statut d'import, ou `null` pour « Prêt à vérifier » et « Échec ». Fonction pure, testée en unitaire.
*Alternative* : une seule animation partout, plus sobre. Gardée en question ouverte : changer la table ne change ni les specs ni les tâches.

### 4. Placement
- Chaque `<Pending>` est rendu sans condition, dans un élément déjà affiché avant l'attente ; seul `label` passe de `null` au texte puis revient à `null`.
- **Import** : `ImportFlow` passe par un état `preparing` pendant `decodePhoto` et remplit le `<Pending>` placé sous le champ. `CropSteps` remplace son booléen `busy` par `busy: "rectify" | "send" | null` et place `<Pending>` dans la barre d'actions de chaque étape, à côté des boutons, qui restent désactivés. `RecropImport` en profite sans changement.
- **Liste des imports** : `<PendingOrb>` devant le badge quand `orbForImport` n'est pas `null`. Pas de `role="status"` par import : le libellé du badge change déjà au rafraîchissement et la liste entière se rafraîchit toutes les 2 s, une annonce à chaque passage serait du bruit.
- **Écran de correction** : `<Pending label="Enregistrement du round…">` dans la barre collée en bas, à côté du bouton. `submit` ne remet plus `saving` à `false` quand l'enregistrement réussit : l'indicateur reste jusqu'à l'arrivée sur la page suivante. Sur doublon ou erreur, `saving` revient à `false` comme aujourd'hui. `LinePlayers` affiche `<Pending label="Création du joueur…">` à côté du bouton « Créer ».
- **Ailleurs** : `LoginForm` et `InlineForm` placent `<Pending>` sous le bouton, rempli quand `pending` est vrai ; `DeleteRound` dans le pied de la boîte de confirmation, monté à l'ouverture de la boîte.
- Les libellés des boutons ne changent pas : les e2e existants qui les ciblent par leur nom restent valides.

### 5. Tests
- Unitaire : `orbForImport` et la table `ORB_FOR`.
- E2e : on ralentit la réponse avec `page.route` (par exemple 1 s sur `POST /api/imports`) pour observer l'indicateur, puis on vérifie qu'il disparaît. On contrôle le `role="status"`, le texte exact, et que le `<canvas>` est `aria-hidden`. Sur `/login`, la région existe et est vide avant le clic sur « Entrer » : un `<Pending>` monté seulement pendant l'attente fait échouer ce test.
- Mouvement réduit : `page.emulateMedia({ reducedMotion: "reduce" })`, puis deux `canvas.toDataURL()` à 300 ms d'écart doivent être égaux ; sans l'émulation, ils diffèrent. Cette garantie vient de la bibliothèque : le test protège contre une mise à jour qui la casserait et contre un `Pending` qui forcerait l'animation.

## Risks / Trade-offs

- [Bibliothèque jeune (0.x, juillet 2026)] → version exacte, un seul point d'import (`pending.tsx`) : la remplacer par un autre indicateur ne touche qu'un fichier.
- [Canvas animé sur un vieux téléphone] → 20 px, pause hors écran et onglet caché, au plus une poignée d'orbes à la fois (la liste des imports en a une par import en attente).
- [Libellé anglais par défaut de l'orbe] → toujours `aria-hidden` ; un test e2e vérifie l'attribut.
- [Le texte « Enregistrement du round… » côtoie le futur « Enregistrement… » de la sauvegarde automatique] → libellés distincts exprès ; voir tâche 5.3.

## Migration Plan

Rien en base. Déploiement normal de l'image. Retour arrière : redéployer le tag précédent.

## Open Questions

- Une seule animation partout (`working`) plutôt qu'une par type d'attente ? À juger sur le téléphone ; seule la table `ORB_FOR` change.
- Faut-il, dans un change à part, un statut « Complétion IA en cours » écrit par le worker avant l'appel à Claude, pour que la liste dise pourquoi une lecture dure plus longtemps ?
- Faut-il un `loading.tsx` pour les navigations lentes sur réseau mobile ? On attend de voir si le cas se présente.
