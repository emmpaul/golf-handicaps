# Design

## Context

Voir `proposal.md`, section « Why », pour l'audit. Ce qui compte ici :

- **Cadre actuel.** `src/app/(app)/layout.tsx` monte `AppNav`, un `<header>` dont la `<nav>` défile de côté (`overflow-x-auto`), puis `<main className="max-w-7xl px-4">`. `tests/e2e/layout-width.spec.ts` impose que `<main>` et la navigation mesurent 1 280 px à 1 440 px de large.
- **Contrôles partagés.** `Button` (`h-8`, `lg` en `h-9`), `Input` (`h-8`, déjà `text-base md:text-sm`) et `NativeSelect` (`h-8 text-sm`) sont des composants shadcn copiés dans `src/components/ui/`, modifiables. La grille des scores (`score-grid.tsx`) a ses propres cases de 44 × 36 px, dans un cadre qui défile de côté (testé dans `mobile.spec.ts`).
- **Barre d'enregistrement.** `round-editor.tsx:329` utilise `sticky bottom-0 -mx-4 py-3`, sans zone sûre.
- **Accès.** `proxy.ts` fait passer toute requête, sauf `_next/static`, `_next/image` et `favicon.ico`, par `decideAccess`, qui ne laisse ouverte que `/login`. Sans changement, le manifest et les icônes seraient redirigés vers `/login`.
- **Projets e2e.** Le projet `webkit-iphone` (iPhone 15, 393 px) ne lance que les fichiers listés dans `MOBILE_SPECS`.
- **PR #19.** La PR ouverte (`feat/thinking-orb-loaders`) modifie `import-flow.tsx`, `import-list.tsx` et `round-editor.tsx`.

## Goals / Non-Goals

**Goals:**
- Un seul endroit décide du passage téléphone ↔ ordinateur : la largeur `md` (768 px), utilisée pour la navigation comme pour la taille des contrôles.
- Les marges de zone sûre passent par des variables CSS posées une fois, pas par des `env()` répétés dans chaque composant.
- Chaque exigence de `specs/app-shell` est couverte par un test e2e mesuré (largeurs, hauteurs, `aria-current`), pas par une capture d'écran.

**Non-Goals:**
- Pas de bibliothèque de navigation ni de composant shadcn supplémentaire : deux listes de liens suffisent.
- Pas de détection du mode écran d'accueil en JavaScript : le CSS (`env(safe-area-inset-*)`) suffit et vaut 0 hors plein écran.
- Pas de nouvelle taille de bouton côté appelants : les composants changent par défaut, les écrans ne passent rien de plus.

## Decisions

### 1. Deux navigations rendues, l'une ou l'autre masquée en CSS

`AppNav` rend :

- l'en-tête du haut, avec la marque et les liens. Les liens ont la classe `hidden md:flex`.
- un `<nav aria-label="Sections">` fixé en bas, avec la classe `md:hidden`.

Les deux lisent la section active avec `usePathname()`. Seuls ces liens actifs passent en composant client (`NavLink`) ; l'en-tête reste un composant serveur. Section active : `pathname === href || pathname.startsWith(href + "/")`. Pour `/imports/…`, la section est « Importer » : une table `SECTION_PREFIXES` relie `/imports` à `/import`.

- *Alternative* : un seul `<nav>` qui change de place selon la largeur. Écartée : son ordre dans le DOM et son `aria-label` seraient les mêmes en haut et en bas, ce qui rend le CSS plus confus.
- `layout-width.spec.ts` vise `getByRole("navigation", { name: "Navigation principale" })`. Ce nom reste sur la `<nav>` du haut, qui garde `max-w-7xl` : le test reste vert sans modification.

Les icônes viennent de `lucide-react`, déjà installé : `Camera`, `ListOrdered`, `TrendingUp`, `Flag`, `Users`. Une constante `icon` s'ajoute à chaque entrée de `LINKS`. Ces entrées servent aussi à la page d'accueil, qui ne lit pas `icon` et ne change pas.

### 2. Variables de mise en page dans `globals.css`

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --tabbar-h: 3.5rem;            /* 56 px : icône + libellé, cible ≥ 44 px */
  --bottom-chrome: calc(var(--tabbar-h) + var(--safe-bottom));
}
@media (width >= 48rem) { :root { --bottom-chrome: var(--safe-bottom); } }
```

Ces variables sont utilisées à quatre endroits :

- **L'en-tête** : `padding-top: var(--safe-top)`.
- **La barre d'onglets** : hauteur `var(--tabbar-h)`, plus `padding-bottom: var(--safe-bottom)`.
- **`<main>`** : `padding-bottom: var(--bottom-chrome)` en plus du `py-4`, pour que le bas de page ne passe pas sous la barre.
- **La barre « Enregistrer »** : `bottom: var(--bottom-chrome)` au lieu de `bottom-0`, ce qui la colle juste au-dessus des onglets. Sur ordinateur, elle prend aussi `padding-bottom: var(--safe-bottom)`.

Le débord `-mx-4` de la barre « Enregistrer » est limité à `max-lg:-mx-4`. Au-delà, la barre garde la largeur du contenu, ce qui corrige le bord qui dépassait à 1 440 px.

- *Alternative* : cacher la barre d'onglets sur les écrans de correction pour laisser la place à « Enregistrer ». Écartée : on perdrait la navigation au milieu d'une correction, et deux barres empilées (56 + 68 px) restent acceptables sur un écran de 852 px. À revoir après la vérification réelle (tâche 9.1) si c'est trop chargé.

### 3. `viewport`, métadonnées et manifest

`layout.tsx` exporte :

- `viewport` : `{ width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" }`. Il n'y a qu'un thème clair : l'app n'a pas de bascule `.dark` active.
- dans `metadata` : `appleWebApp: { capable: true, title: "Golf", statusBarStyle: "default" }`. Avec `default`, la barre d'état reste opaque et blanche, et le contenu ne passe pas dessous. `black-translucent` imposerait `--safe-top` partout, pour un gain visuel nul sur fond blanc.

`src/app/manifest.ts` (`MetadataRoute.Manifest`) contient : nom, nom court, `start_url: "/"`, `display: "standalone"`, `background_color` et `theme_color` blancs, `lang: "fr"`, et les icônes `/icon/192` et `/icon/512`.

### 4. Icônes dessinées avec `next/og`

`src/app/icon.tsx` utilise `generateImageMetadata` pour produire deux tailles, avec les ids `192` et `512`, servies à `/icon/192` et `/icon/512`. `src/app/apple-icon.tsx` produit une image de 180 px. Les deux partagent un composant `AppGlyph` (`src/app/app-glyph.tsx`) : un drapeau de green dessiné en `div` (mât, fanion rouge, disque vert) sur fond vert foncé, avec une marge de sécurité de 10 % pour les masques Android.

- *Alternative* : l'emoji ⛳ dans `ImageResponse`. Écartée : `next/og` va chercher les emoji sur un CDN au moment du rendu, ce qui casse le build Docker hors ligne et ajoute une dépendance réseau.
- *Alternative* : des PNG fixes dans `src/app/`. Écartée : il faudrait un outil hors du dépôt pour les refaire. Le code se relit et se modifie.

### 5. Ouvrir les fichiers d'installation sans session

Dans `access.ts`, `PUBLIC_PATH` devient un ensemble exact : `/login`, `/manifest.webmanifest`, `/apple-icon`, `/icon/192` et `/icon/512`. La requête est comparée au chemin seul, la query `?<hash>` ajoutée par Next n'entre pas en compte. Un préfixe (`startsWith("/icon")`) est écarté : il ouvrirait toute page future dont le nom commence par `icon` (spec, scénario « Page proche d'un fichier d'installation »).

Le `matcher` du proxy ne change pas : la décision reste dans `decideAccess`, qui est testé en unitaire.

### 6. Taille des contrôles : changer les valeurs par défaut des composants `ui/`

| Composant | Sous `md` | À partir de `md` |
|---|---|---|
| `Button` `default` | `h-11` | `h-8` (inchangé) |
| `Button` `lg` | `h-11` | `h-9` (inchangé) |
| `Button` `icon` | `size-11` | `size-8` (inchangé) |
| `Input` | `h-11` | `h-8` |
| `NativeSelect` | `h-11 text-base` | `h-8 text-sm` |

Les tailles `xs` et `sm` ne changent pas : elles ne sont pas utilisées dans les écrans (à vérifier par `grep` à la tâche 3.1). Les boutons du calendrier gardent leur propre `--cell-size` (décision 7).

Les liens d'action isolés (« Vérifier », « Recadrer la photo », « Ouvrir l'écran de correction vide », « Saisir un round à la main », « Saisie manuelle ») gardent leur style de lien. Ils reçoivent `inline-flex min-h-11 items-center` sous `md`. Pour éviter de répéter ces classes, une constante `ACTION_LINK` est ajoutée dans `src/lib/utils.ts`.

La grille des scores garde ses cases de 44 × 36 px. Sa hauteur est un compromis voulu : 18 trous et 4 lignes doivent tenir à l'écran. La spec l'exclut explicitement, et le test de mesure ignore les `textbox` de la `table`.

- *Alternative* : une nouvelle taille `touch`, passée écran par écran. Écartée : on en oublierait toujours un, alors qu'aucun écran ne veut aujourd'hui de petits contrôles sur téléphone.

### 7. Calendrier qui tient dans 320 px

`date-field.tsx:99` passe à `[--cell-size:min(--spacing(11),calc((100vw-2.5rem)/7))]`. Le popover reçoit `collisionPadding={8}`. À 320 px, cela donne des cellules de 40 px, et 44 px dès 348 px.

### 8. Handicaps : marque dans la cellule de date sous `md`

La 4e colonne (`Compte`) devient `hidden md:table-cell`. Sous `md`, le badge se place dans la cellule de date, derrière la date, et la date passe au format court (« 18 sept. 2026 »). Les deux dates sont rendues, l'une ou l'autre masquée en CSS, pour qu'aucun texte ne change selon le rendu serveur. La marque reste annoncée, avec le même texte « Compte ».

Sur ordinateur, la courbe (`index-curve.tsx`) passe de `h-48` à `h-48 lg:h-full lg:min-h-48`, et la grille de la section utilise `lg:items-stretch` : la courbe prend la hauteur de la table.

### 9. Petites passes ordinateur

- **Classement net** : `NetLeaderboard` est enveloppé d'un `max-w-2xl`.
- **Imports** : la date passe au format `formatPlayedOn` suivi de l'heure (« 17 octobre 2026, 19:32 ») et l'action (`ml-auto`) reste sur la même ligne grâce à `flex-nowrap` sur le couple badge + action.
- **Joueurs** : la carte « Ajouter un joueur » passe en tête de la grille sur ordinateur aussi, comme sur téléphone, et les cartes d'une même rangée gardent leur hauteur naturelle (`items-start`).
- **Coups** : les libellés « Mode » et « Parcours » utilisent le même style (`Label`).

### 10. Champ fichier natif

Dans `import-flow.tsx`, l'`<input type="file">` « Photo de la carte » passe en `sr-only`. Son `<label>` est stylé avec `buttonVariants({ variant: "outline" })` et affiche « Choisir une photo », sur le modèle de « Prendre une photo », déjà en place. Le libellé accessible reste « Photo de la carte », via `aria-label` sur le champ : `getByLabel("Photo de la carte")` et le test de `camera-capture` restent valides. Le focus clavier reste visible avec `focus-within:` sur le label.

## Risks / Trade-offs

- [Deux barres en bas sur l'écran de correction (onglets + Enregistrer) réduisent la zone de saisie.] → La barre « Enregistrer » est en `py-2`. Tâche 9.1 : vérification réelle sur iPhone. Si c'est trop chargé, on cache les onglets sur `/imports/[id]`, `/rounds/new` et `/rounds/[id]/edit`, dans un change séparé.
- [Agrandir `Button`, `Input` et `NativeSelect` change la mise en page de tous les écrans mobiles.] → Pour la largeur, le test e2e « toutes les pages à 320 et 390 px » couvre ce changement. Pour l'aspect, on relance le script d'audit sur toutes les captures (tâche 7.2).
- [WebKit dans Playwright renvoie 0 pour `env(safe-area-inset-*)`.] → Les e2e vérifient les variables et la structure (`--bottom-chrome`, `bottom` de la barre). La présence réelle sous l'encoche relève de la tâche 9.1.
- [Le manifest et les icônes sont ouverts sans session.] → La liste est exacte et ne contient aucune donnée. Le test unitaire de `decideAccess` vérifie à la fois l'ouverture et le refus des chemins voisins.
- [Conflit avec la PR #19.] → Ce change se rebase sur `main` après sa fusion. Les zones touchées des mêmes fichiers sont distinctes (classes de mise en page ici, état d'attente là-bas).
- [iOS met en cache l'icône d'écran d'accueil.] → Rien à faire dans le code. Il faut supprimer puis rajouter l'icône pendant la vérification réelle.
