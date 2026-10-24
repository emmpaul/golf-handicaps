# Design

## Context

Voir `proposal.md` pour la motivation. Audit Hallmark du 2026-10-24 (`/hallmark audit`, commit `c9bab41`), sur une base de démonstration hors dépôt (14 rounds entre mai et octobre 2026, Gab, Manu et Sean, 4 parcours), rendue à 390 × 844 et 1440 × 900, clair et sombre. Captures dans `.hallmark/before/`, relevé dans `.hallmark/before.txt`, enregistrement du câblage dans `.hallmark/before.json` (31 liens, 7 champs, 43 gestionnaires, 19 `data-testid`).

**Lecture.**

- **À quoi sert l'app** : trois amis qui jouent au simulateur (GSPro) suivent leur index, leurs rounds et les coups à se donner, surtout au téléphone. Action principale : importer la photo de fin de round.
- **Ce qui marche et reste** : la coquille (en-tête, barre d'onglets du bas, zones sûres), les marques birdie / bogey avec leur texte pour lecteurs d'écran, les chiffres tabulaires, le sélecteur un-joueur-à-la-fois de Handicaps sur téléphone, le fondu des grilles qui défilent, la marque dessinée à la place de l'emoji.
- **Ce qui fait généré** : tout est composant shadcn par défaut. Chaque liste est une pile de cartes arrondies à filet (14 cartes identiques sur Rounds, cartes de formulaires sur Joueurs et Parcours) ; badges en pilule pleine (« Compte ») ; une seule police (Geist) et une seule échelle ; titres de page petits ; métadonnées jointes par des points médians ; la carte de score, objet propre à l'app, est un petit tableau encadré coupé au trou 6.
- **Ce qui est cassé** : voir les relevés ci-dessous, plus la saisie manuelle entièrement rouge à l'ouverture et la colonne « Rang » tronquée à 390 px.

**Relevés du linter** (`sloplint --scope app --genre modern-minimal`, statique ; le rendu n'a pas tourné car l'app est derrière le code d'accès, les captures ont été prises à part avec un cookie de session) :

| Gate | Palier | Où | Constat |
| --- | --- | --- | --- |
| 10a | Floor | `src/components/ui/button.tsx:5`, `badge.tsx:6`, `toggle.tsx:7` | `transition-all` |
| 27 | Floor | `src/components/ui/alert-dialog.tsx:30` | `animate-in` / zoom sans `motion-reduce:` |
| 34 | Floor | `src/app/globals.css:1` | pas de `overflow-x: clip` sur `html` et `body` |
| 48 | Floor | `src/app/app-glyph.tsx:11`, `:45`, `:56` | couleurs en dur dans le rendu `next/og` |
| 29 | WARN | `alert-dialog.tsx:30` | voile `backdrop-blur` sur `bg-black/10` |
| F1 | Finish | `courses/page.tsx:195`, `handicaps/page.tsx:69`, `login/login-form.tsx:15`, `import/recrop-import.tsx:40` | apostrophes droites |
| F16 | Finish | `globals.css` | `::selection`, `caret-color`, `scrollbar-color` non thémés |

**Gates jugés sur les captures** :

| Gate | Palier | Où | Constat |
| --- | --- | --- | --- |
| 63 | Floor | `rounds/[id]/page.tsx:27` (« Tees Red · 17 octobre 2026 · Par 71 »), `courses/page.tsx:43`, `:84`, `strokes-planner.tsx:131`, `rounds/[id]/page.tsx:36` | chaînes à deux points médians ou plus |
| 63 (un point) | jugé | `page.tsx:69`, `rounds/page.tsx:36`, `courses/page.tsx:106`, `:142` | « PARCOURS · Tees » : on change aussi, par cohérence |
| F25 | Finish | `components/rounds/net-leaderboard.tsx` à 390 px | colonne « Rang » hors écran |
| états | app | `round-editor.tsx:148`, `score-grid.tsx:75` | grille entière en erreur avant toute saisie (`/rounds/new`) |
| 3, F7 | Reflex / Finish | Rounds, Joueurs, Parcours, accueil | la même carte arrondie à filet partout ; « tables avant cartes » en portée app |
| signature | app | `components/rounds/round-scorecard.tsx` | l'objet propre à l'app (la carte de score) est traité comme un tableau secondaire |
| data-viz | Finish | `components/handicaps/index-curve.tsx` | graduations « 22.95 », « 21.25 » : décimales non arrondies et point au lieu de la virgule |

Le linter a lu `src/app` et `src/components` (68 fichiers). Gates de page marketing (héros, pli, budget de mots, rythme des sections) sautés en portée app.

**Contraintes en place** : specs `app-shell` (cibles 44 px, champs 16 px sous `md`, pas de défilement horizontal dès 320 px, zones sûres, contenu défilant signalé, onglet courant visible), `visual-theme` (mode sombre suivant le système, `theme-color` par mode, chiffres alignés, marques de score avec texte), `handicap-index` (un joueur à la fois sous 768 px), `loading-feedback` (indicateurs et mouvement réduit). Les composants `ui/*` sont des wrappers `@base-ui/react` générés par shadcn (`components.json`, style `base-nova`), et les écrans s'appuient sur les variables shadcn (`bg-primary`, `text-muted-foreground`…) via `@theme inline`.

## Goals / Non-Goals

**Goals:**

- Une direction visuelle propre à ce groupe et à ce jeu, qui ne pourrait pas servir à une autre app sans changement.
- Floor Hallmark à 0 FAIL en portée app, Reflex corrigés ou levés par écrit dans le tampon.
- Câblage intact : `sloplint --kept` sans `FAIL kept`, typecheck, lint, tests unitaires et e2e verts.
- Système verrouillé dans un `DESIGN.md` à la racine, pour que les prochains écrans le suivent.

**Non-Goals:**

- Retirer shadcn ou `@base-ui/react` : les composants gardent leur API, leurs `data-slot` et leurs variantes ; seul leur style change.
- Mode clair/sombre réglable dans l'app.
- Photographies ou illustrations : une app d'outil se montre par ses propres données.
- Écran de recadrage (`imports/[id]/recadrer`) au-delà des tokens et des contrôles.

## Decisions

### D1. Hallmark *redesign*, profondeur *full*, portée *app*, direction *custom*

`/hallmark redesign src/app` en profondeur *full* : contenu et câblage gardés, système et composition changés, écran par écran dans la coquille existante (`flow.md` § App screens, `redesign.md`). Direction *custom* (`direction.md`) à la demande de l'utilisateur : pas de thème tiré du catalogue, pas de marque gardée. La palette Fairway est une marque au sens de `redesign.md`, mais l'utilisateur a demandé de la remplacer ; le Picks block le dira.

*Écarté* : thème tiré (Almanac sortait en tête du tirage) ; garder Fairway et ne changer que les composants (profondeur *restyle*), qui laisserait le vert attendu pour la catégorie.

### D2. Trois directions, une retenue

Trois directions éloignées, deux lignes chacune ; l'apply part de la retenue et ne change que si l'utilisateur la refuse à la revue de ce change.

1. **Le tableau des scores (retenue).** L'idée : l'app est le tableau de leaderboard du groupe, et le golf a déjà son code couleur : rouge sous le par, encre au-dessus. Fond clair froid, encre bleu-nuit dense, un seul rouge qui ne porte que du sens (sous le par, birdie, gagnant net) ; une police condensée à chasse fixe pour les noms et les chiffres posés en grand, une sans-serif de texte à côté ; bandeaux d'encre pleine pour l'en-tête du tableau, lignes réglées en deux graisses, coins droits. Accueil = le tableau (joueurs, index en très grand, écart) ; Rounds = un registre en lignes, pas de cartes ; round = la carte de score en objet principal, pleine largeur, avec le classement au-dessus.
2. **Le carnet de distances.** L'app comme carnet de caddie : colonne étroite, numéros de trou énormes, par / index / distance comme une page de carnet par trou ; tons papier kraft et graphite. Écarté : proche du look « papier + accent terre » interdit (gate 65) et pousse vers le dessin de trous (gate 80).
3. **La salle du simulateur.** Sombre par défaut comme la pièce où ils jouent, chiffres blanc craie, une lumière ambre de projecteur. Écarté : « presque noir avec un accent vif » est dans la liste des looks usés, et l'app sert surtout en plein jour.

Pourquoi le tableau : l'app répond d'abord à « qui mène, de combien, et combien de coups je reçois », exactement ce qu'affiche un leaderboard ; le rouge sous le par est un fait du golf et pas une couleur choisie pour la catégorie ; les chiffres deviennent l'image (pas de photo à trouver). Ce qu'on garde des autres : la place donnée au numéro de trou (2) dans la grille des coups.

Valeurs exactes (OKLCH), polices et échelle fixées à l'apply, vérifiées par `theme.mjs check --hue` et `--face`. Candidates libres de collision au catalogue au 2026-10-24 : Antonio, Sofia Sans Condensed (condensées) ; la police de texte est choisie dans `fonts.md` § Body faces, hors liste bannie. Le rouge vise une teinte ~25-30 : `check --hue 25` signale Broadside, Coral et Halftone comme voisins, à comparer à leurs images avant de fixer l'axe (fond froid et police condensée les éloignent déjà).

### D3. Tokens Hallmark, variables shadcn pointées dessus

`theme.mjs scaffold --custom --redesign full --scope app` écrit `src/app/tokens.css` et `src/app/base.css`, importés juste après les `@import` existants de `globals.css`. Les variables shadcn (`--background`, `--primary`, `--muted-foreground`, `--chart-*`, `--sidebar-*`…) et les variables de l'app (`--birdie`, `--bogey`, `--sand`, `--ai`) deviennent des `var()` vers les tokens (`export-formats.md` § shadcn/ui), clair et sombre. `--color-accent` et `--color-muted` de Hallmark sont renommés (`--color-signal`, `--color-ink-3`) pour ne pas entrer en collision avec `accent` / `muted` de shadcn. `--sand` disparaît ; ses usages sont remplacés.

*Écarté* : réécrire les classes Tailwind de chaque écran vers de nouveaux noms : diff énorme, et casse les composants shadcn.

### D4. Composants `ui/*` restylés sur place

Chaque fichier garde ses exports, ses props, ses variantes `cva` et ses `data-slot` ; seules les classes changent : transitions nommées (`transition-colors`, `transition-[opacity,transform]`), `focus-visible` sans transition, `active:` et `disabled:` sur tous les contrôles, hauteurs de 32 à 40 px sur ordinateur avec cible de 44 px (et la règle `app-shell` sous `md`), `motion-reduce:` sur `alert-dialog` et `popover`, voile plein au lieu du flou. Badge : plus de pilule pleine pour « Compte ». Card : un seul niveau de contenant, sans ombre douce sous filet.

### D5. Icônes `next/og`

`ImageResponse` ne lit pas le CSS : `app-glyph.tsx` reçoit ses couleurs d'un module `src/app/brand-colors.ts` qui porte les valeurs hex des tokens, avec un test unitaire qui compare ces valeurs aux tokens de `tokens.css` (le test rougit si l'un change sans l'autre). Le linter garde un FAIL 48 sur ce module : il est levé dans le tampon avec sa raison (rendu `next/og` hors CSS). Si la gate 48 n'accepte pas de levée, les couleurs passent en props depuis `icon.tsx` / `apple-icon.tsx` lues dans `tokens.css` à la construction. `themeColor` de `layout.tsx` suit la même source.

### D6. Recomposition des écrans

Chaque écran est recomposé dans la coquille actuelle (`AppNav`, `main` en `max-w-7xl`, barre d'onglets) : même ordre de contenu quand une spec le fixe (`home-dashboard`), composition libre sinon. Règles communes : tables avant cartes, un seul type de contenant, l'accent ne marque que l'action principale, la sélection et l'état, chaque zone qui charge des données garde ses états existants (chargement, vide, erreur, plein) et les états sans logique sont listés au propriétaire, pas construits. Le tampon Hallmark nomme `hero:` par route.

### D7. Ce que les tests gardent

Rien n'est supprimé de `before.json` : `data-testid`, `name`, `id`, `href`, gestionnaires. Les seuls tests modifiés sont ceux dont la spec change ici : `tests/e2e/rounds.spec.ts:39` et `home.spec.ts` (points médians), l'e2e de la saisie manuelle (`manual-entry.spec.ts`) pour les cases « à remplir », et le test du fondu de `mobile.spec.ts`, qui passe de 390 à 800 px (D9). `correction.spec.ts:54-59` (cases en défaut après OCR) ne change pas. Nouveaux e2e : classement à 320 px, mouvement réduit sur la boîte de confirmation, focus visible sur la barre d'onglets.

### D8. Verrouillage du système

Après le scaffold et les composants de base, `DESIGN.md` à la racine (`design-md.md`) fixe palette, polices, échelle, contenants, contrôles et l'idée. Les écrans suivants le lisent. Au-delà de trois écrans, chaque écran peut être confié à un sous-agent avec `DESIGN.md`, ses fichiers et `redesign.md`.

### D9. Téléphone d'abord

Le groupe se sert de l'app au téléphone : chaque écran est composé à 390 px, vérifié à 320 px, puis étendu à 768 et 1440 px. Les captures Hallmark, le balayage et la revue de finition jugent 390 et 320 px avant l'ordinateur. Sous 768 px, aucun cadre ne défile de côté (specs `app-shell`, `rounds`, `scorecard-import`) :

- **Carte de score d'un round** (`round-scorecard.tsx`) : deux blocs empilés, aller (1 à 9, OUT) puis retour (10 à 18, IN, TOT), chacun avec ses libellés. À 320 px : libellés sur ~56 px, 10 colonnes de ~23 px ; la police condensée de D2 porte les chiffres, les marques birdie / bogey se resserrent à la taille de la case.
- **Grille de correction et de saisie** (`score-grid.tsx`) : disposition transposée, une ligne par trou (trou, par, index, puis une colonne par ligne de joueur), OUT après le trou 9, IN et TOT après le 18 ; noms des joueurs dans une rangée d'en-tête collante ; distance sur une sous-ligne sous le numéro du trou. À 320 px avec 4 joueurs : trou ~36 px + 6 cases de ~42 px × 44 px de haut. Les deux dispositions viennent du même état et des mêmes `aria-label` (« Ligne 1 trou 9 ») ; une seule est rendue selon une requête de conteneur ou de média, pour ne pas dupliquer les champs.
- **Classement net, tableaux Handicaps, listes** : colonnes resserrées et libellés courts sous 768 px, aucune colonne masquée.
- **Grille des coups** : tient déjà à 320 px (spec `match-strokes`), inchangée sur ce point.
- `ScrollFrame` ne sert plus qu'à partir de 768 px, quand 18 trous ne tiennent pas dans la grille large.

Vérification : un helper e2e commun, `expectNoSideScroll(page)`, parcourt les éléments de `main` et échoue si l'un a `scrollWidth > clientWidth + 1` ; il tourne sur chaque route à 320 et 390 px, avec un round à 4 joueurs.

*Écarté* : garder la grille de 18 colonnes en défilement avec fondu sur téléphone (état actuel) ; la vue « un trou à la fois » avec flèches, qui cache la carte entière et ralentit la correction d'une carte lue par OCR.

### D10. En-tête sous la barre d'état d'iPhone

Constat (capture de l'utilisateur, 2026-10-24, iPhone en mode sombre) : la marque et « Golf » sont flous sous la barre d'état. L'app ne dessine aucun flou à cet endroit (seul `alert-dialog.tsx` a un `backdrop-blur`) : c'est l'effet de bord de Safari iOS 26 (Liquid Glass), qui floute le contenu sous la barre d'état et prend sa teinte dans le fond de `body` ou d'un élément fixe ou collant touchant le haut ; `theme-color` n'y est plus fiable. Aujourd'hui `app-nav.tsx:43` est un `header` non collant, `pt-(--safe-top)` puis `py-2` : la rangée de la marque tombe dans la bande floutée et défile dessous.

Décision :

- `header` en `sticky top-0` avec un fond token entièrement opaque (pas d'alpha, pas de `backdrop-filter`), au-dessus du contenu (`z-index` du jeton de chrome) ; Safari prend alors sa teinte dans l'en-tête et le contenu qui défile passe sous un fond plein.
- `html` et `body` ont le même fond que l'en-tête, en clair et en sombre, pour que la teinte soit juste quel que soit l'élément échantillonné.
- La rangée de la marque garde au moins 8 px de marge sous `safe-area-inset-top`, en plus de la zone sûre, pour sortir de la bande.
- Voile de la boîte de dialogue opaque (déjà prévu en D4) : un élément fixe semi-transparent fausse la teinte (rapport de Ben Frain sur iOS 26).
- `manifest.ts` : `theme_color` et `background_color` depuis la même source que `themeColor` de `layout.tsx` et les icônes (`brand-colors.ts`, D5).

*Écarté* : un `div` fixe flouté sur la zone de la barre d'état (contournement courant) : il ajoute du flou au lieu de l'enlever ; masquer l'en-tête au défilement : la coquille garde sa navigation.

Vérification : l'e2e couvre ce qui se mesure (en-tête collé, fond opaque, même couleur que `html` / `body`, manifest) ; le flou lui-même ne se voit que sur un vrai iPhone, d'où une vérification manuelle par l'utilisateur, une étape à la fois. Le comportement de Safari a changé entre iOS 26.0, 26.1 et 26.2 : la vérification note la version d'iOS.

## Risks / Trade-offs

- [Safari iOS change encore sa teinte et son flou d'une version à l'autre] → vérification manuelle notée avec la version d'iOS ; un en-tête opaque et collé reste le cas le plus simple pour le moteur de teinte.
- [Un en-tête collé prend de la hauteur sur téléphone] → une seule rangée (marque, « Golf »), environ 44 px plus la zone sûre ; la navigation reste dans la barre d'onglets du bas.

- [La grille de correction transposée est longue (~20 lignes de 44 px)] → rangée d'en-tête collante avec les noms, liste des problèmes en tête qui mène à la case en défaut, sauvegarde automatique inchangée.
- [Deux dispositions d'une même grille] → un seul composant et un seul état, une seule disposition rendue à la fois ; les tests qui trouvent les cases par leur nom accessible restent valables aux deux largeurs.

- [Le linter de rendu ne passe pas le code d'accès] → captures et `--kept` faits avec un cookie de session signé par `SESSION_SECRET` local (script Playwright hors dépôt, comme `tests/e2e/session.ts`) ; `sloplint --url` sur `/login` seul ; les gates de rendu sur les écrans protégés sont jugés sur les captures.
- [Base de démonstration hors dépôt] → la base de 14 rounds vit dans le dossier temporaire de la session ; l'apply la recrée avec le même script de seed (via `saveRound`) dans un `DATA_DIR` jetable, jamais dans `data/`.
- [Le rouge « sous le par » et la couleur destructive se confondent] → la couleur destructive prend une autre teinte ou passe par le texte et l'icône ; scénario `visual-theme` : la destructive reste distincte de la principale, et les marques distinctes de la principale.
- [Une police condensée fatigue en texte courant] → elle ne porte que les noms, les chiffres et les titres ; le texte reste dans la police de texte à 16 px.
- [Diff très large, difficile à relire] → arbre propre au départ, commits par étape (tokens, composants, chaque écran), `.hallmark/compare.html` avant/après joint à la PR.
- [Les specs `visual-theme` ne fixent plus de valeurs hex] → une fois les tokens choisis, l'apply ajoute les valeurs exactes aux scénarios de « Palette sur mesure » et « Marques de score » de ce change avant l'archive.

## Migration Plan

Pas de données. Déploiement normal par PR et release. Retour arrière : revert du commit de fusion ; aucune migration à défaire.
