# Proposal

## Why

Le groupe se sert de l'app surtout au téléphone, et l'app y reste un thème shadcn par défaut en niveaux de gris, avec un emoji pour logo, sans identité ni hiérarchie. Un passage à 390 et 320 px sur toutes les pages (base de 15 rounds, 3 joueurs, un import lu, 2026-10-23) montre des écrans qui se lisent mal au doigt : l'accueil répète la barre d'onglets, la grille de correction cache 12 trous sur 18 sans le signaler, le bouton de retrait d'une ligne de joueur tombe seul sur sa ligne, la page Handicaps aligne trois longues sections à faire défiler (plus de 8 000 px de haut à 390 px), le round n'affiche aucun score par trou et les coups à donner se lisent dans une liste de numéros.

## What Changes

- **Thème « Fairway ».** Nouvelle palette dans les variables de `globals.css` : fond papier chaud, vert fairway en couleur principale, sable en accent, rouge birdie et ardoise bogey pour les marques de score. Thème sombre qui suit le réglage du téléphone, `theme-color` assorti dans les deux modes. Marque d'app dessinée (le glyphe des icônes) à la place de l'emoji ⛳ dans l'en-tête. Chiffres tabulaires partout où des nombres s'alignent.
- **Accueil en tableau de bord.** L'accueil remplace les cinq cartes de liens par : l'action « Importer une carte », l'index actuel de chaque joueur avec son écart depuis son round précédent, le dernier round avec son gagnant net, et les imports qui attendent une vérification. Le titre « Handicaps golf » et « Se déconnecter » restent.
- **Round : carte de score.** La page d'un round affiche les scores trou par trou de chaque joueur, avec par, index et marques birdie / bogey, dans un cadre qui défile sur téléphone.
- **Handicaps : un joueur à la fois sur téléphone.** Sous 768 px, un sélecteur de joueur affiche une section à la fois, avec l'index en grand et son écart depuis le round précédent ; la marque « Compte » reste sur la ligne de la date. Sur ordinateur, toutes les sections restent visibles.
- **Coups : grille de 18 trous.** Chaque joueur voit ses coups dans une grille de 18 cases (aller, retour), au lieu d'une liste de numéros. « Aucun coup » ne répète plus « reçoit 0 coup ».
- **Grilles larges signalées.** Un contenu qui défile dans son cadre (grille de correction, carte de score, grille de coups) montre qu'il en reste à voir (fondu au bord et numéros des trous visibles), et la colonne des libellés reste fixe.
- **Lignes de joueur de l'éditeur.** Numéro, nom lu, liste du joueur et bouton de retrait tiennent sur un bloc lisible dès 320 px, sans bouton isolé sur sa ligne.
- **Passe de finition.** Hiérarchie de l'écran d'import (une action principale), champs de rating avec exemples clairement marqués comme tels, état courant de la barre d'onglets plus visible, densité des cartes Joueurs. Rien de tout cela ne change ce que fait l'app.
- **Hors périmètre** : nouvelles fonctions (statistiques, comparaisons), changement de libellé des sections, police de titres autre que Geist, animations au-delà des transitions existantes, refonte de l'écran de recadrage.

## Capabilities

### New Capabilities

- `visual-theme` : palette claire et sombre de l'app, bascule selon le réglage du système, marque d'app, couleurs des marques de score et chiffres alignés.
- `home-dashboard` : contenu de la page d'accueil (action d'import, index des joueurs, dernier round, imports à vérifier).

### Modified Capabilities

- `app-shell` : les contenus qui défilent dans leur cadre signalent la suite et gardent leur colonne de libellés.
- `rounds` : la page d'un round affiche la carte de score trou par trou.
- `handicap-index` : sur téléphone, l'historique s'affiche un joueur à la fois, avec l'écart depuis le round précédent.
- `match-strokes` : les coups par trou s'affichent dans une grille de 18 trous.
- `scorecard-import` : les lignes de joueur de l'éditeur restent groupées dès 320 px.

## Impact

- **Code** : `src/app/globals.css`, `src/app/layout.tsx` (thème sombre, `themeColor`), `src/components/app-nav.tsx`, `src/app/(app)/page.tsx` et un nouveau `src/server/home/` (lecture des données de l'accueil), `src/app/(app)/rounds/[id]/page.tsx` avec `src/server/rounds/detail.ts`, `src/app/(app)/handicaps/page.tsx` et `src/components/handicaps/index-curve.tsx`, `src/components/strokes/strokes-planner.tsx`, `src/components/round-editor/line-players.tsx` et `score-grid.tsx`, pages Import, Joueurs et Parcours pour la finition.
- **Tests** : nouveaux tests e2e (accueil, carte de score, sélecteur Handicaps, grille des coups, thème sombre) ; les tests existants qui ciblent des textes changés (« Aucun coup », liste « Trous : … ») suivent la spec.
- **Dépendances** : aucune. Pas de migration de base.
- **Change en cours** : `add-course-rating` modifie les requirements « Classement net d'un round » et « Modes de calcul des coups » ; ce change n'y touche pas et ajoute des requirements à côté.
