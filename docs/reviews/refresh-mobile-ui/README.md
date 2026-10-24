# Refresh mobile UI

Captures de la version Fairway à 390 px, avec un pointeur tactile et les données de référence des tests. Les pages longues utilisent une fenêtre plus haute pour placer les barres fixes sous le contenu. Les tests de largeur et de cibles tactiles utilisent une hauteur de téléphone normale.

Reproduire les captures avec `pnpm e2e tests/e2e/layout-width.spec.ts --grep 390px --project chromium`. Les fichiers PNG et pièces jointes sont écrits dans `test-results/`.

| Page | Clair | Sombre |
| --- | --- | --- |
| Accueil | ![Accueil, clair](home-light.png) | ![Accueil, sombre](home-dark.png) |
| Importer | ![Importer, clair](import-light.png) | ![Importer, sombre](import-dark.png) |
| Correction | ![Correction, clair](correction-light.png) | ![Correction, sombre](correction-dark.png) |
| Rounds | ![Rounds, clair](rounds-light.png) | ![Rounds, sombre](rounds-dark.png) |
| Carte de score | ![Carte de score, clair](round-light.png) | ![Carte de score, sombre](round-dark.png) |
| Handicaps | ![Handicaps, clair](handicaps-light.png) | ![Handicaps, sombre](handicaps-dark.png) |
| Coups | ![Coups, clair](strokes-light.png) | ![Coups, sombre](strokes-dark.png) |
| Joueurs | ![Joueurs, clair](players-light.png) | ![Joueurs, sombre](players-dark.png) |
| Parcours | ![Parcours, clair](courses-light.png) | ![Parcours, sombre](courses-dark.png) |
