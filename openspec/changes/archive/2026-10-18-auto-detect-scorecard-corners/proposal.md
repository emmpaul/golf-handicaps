# Proposal

## Why

Chaque import demande aujourd'hui de placer 4 poignées sur les coins du panneau. Elles partent à 10 % et 90 % de la photo, donc il faut les déplacer toutes les quatre, au doigt, sur un téléphone, avant de valider un aperçu. C'est l'étape la plus lente de l'import, et elle se répète pour chaque carte. La carte GSPro a une mise en page fixe et très contrastée (bandeau sombre, tableau clair, bande « ROUND SETTINGS ») : le serveur peut trouver ses coins seul dans la plupart des cas, et Claude peut le faire quand la photo est difficile.

## What Changes

- **Envoi sans cadrage** : choisir ou prendre une photo la met en file tout de suite. Plus de poignées, plus d'aperçu redressé à l'envoi.
- **Détection locale des coins dans le worker** : avant la lecture, le worker cherche le panneau sur la photo (tableau clair, bandeau sombre au-dessus), en déduit les 4 coins et vérifie que le panneau redressé ressemble bien à une carte GSPro. Aucune nouvelle dépendance.
- **Repli IA pour la détection** : si la détection locale échoue et qu'une clé `ANTHROPIC_API_KEY` est configurée, le worker envoie à Claude une copie réduite de la photo (1568 px sur le grand côté) et lui demande les 4 coins. Les coins rendus passent la même vérification. Cet appel compte dans le plafond mensuel.
- **Échec explicite** : si aucun cadrage n'est trouvé, l'import passe en « Échec » avec « Panneau introuvable sur la photo », sans seconde tentative de job, et propose de recadrer à la main ou d'ouvrir l'écran de correction vide.
- **Cadrage manuel en repli seulement** : « Recadrer la photo » reste disponible pour un import en « Échec », et devient aussi disponible pour un import « Prêt à vérifier » pas encore enregistré, depuis la liste et depuis l'écran de correction. Les poignées partent des coins détectés quand il y en a.
- **BREAKING (API interne)** : `POST /api/imports` ne prend plus de champ `corners`. La colonne `imports.corners` devient nullable (`null` tant que le cadrage n'est pas trouvé).
- **BREAKING (spec)** : la règle « la photo d'origine n'est jamais envoyée à un service tiers » est assouplie. Une copie réduite de la photo peut partir chez Anthropic, et seulement dans le cas de repli ci-dessus.

## Capabilities

### New Capabilities

- `scorecard-panel-detection` : trouver les 4 coins du panneau GSPro sur une photo sans aide de l'utilisateur. Couvre la détection locale, la vérification du panneau redressé, le repli par Claude, son budget, les données envoyées et le cas où rien n'est trouvé.

### Modified Capabilities

- `scorecard-import` :
  - « Envoi d'une photo » et « Prise de photo depuis l'app » : la photo part en file sans écran de cadrage.
  - « Cadrage de la carte » devient le recadrage manuel en repli.
  - « Lecture en tâche de fond » : nouvel échec « Panneau introuvable sur la photo ».
  - « Lecture OCR sans service externe » : deuxième exception, la photo réduite envoyée pour la détection.
  - « Nouvelle lecture après recadrage » : on peut aussi recadrer un import « Prêt à vérifier ».
- `scorecard-ai-completion` : « Déclenchement uniquement en repli » et « Plafond de dépense mensuel » couvrent désormais deux appels possibles par import (cadrage puis complétion), chacun au plus une fois, sous le même plafond.

## Impact

- **Code** :
  - Nouveau `src/ocr/detect-panel.ts` (détection locale et vérification) et `src/ai/corner-locator.ts` (repli Claude).
  - `src/jobs/ocr-scorecard.ts` : étape de cadrage avant la lecture quand l'import n'a pas de coins.
  - `src/jobs/imports.ts` : `createImport` sans coins, `recropImport` accepte « Prêt à vérifier ».
  - `src/app/api/imports/route.ts` : plus de champ `corners`.
  - `src/components/import/import-flow.tsx` : envoi direct ; `crop-steps.tsx`, `corner-editor.tsx` et `rectify-preview.ts` ne servent plus qu'au recadrage.
  - Liste des imports et écran de correction : lien « Recadrer la photo » sur un import prêt.
  - `scripts/ocr-debug.ts` : coins facultatifs, détectés quand absents.
- **Base** : migration `imports.corners` nullable. Les imports existants gardent leurs coins.
- **Coût** : environ 3 ¢ de plus par photo où la détection locale échoue (≈ 3 000 tokens en entrée). Aucun coût quand elle réussit.
- **Confidentialité** : dans le cas de repli, la photo entière (réduite) part chez Anthropic : écran, salle, reflets éventuels. À ne configurer que si le groupe est d'accord, comme la complétion.
- **Ordre** : indépendant de `store-photos-as-webp` (PR #24). Si celui-ci est fusionné avant, la détection lit le WebP enregistré comme elle lirait le JPEG.
- **Risque** : une seule photo de référence existe (`IMG_3064`). Il faut quelques photos de plus, prises dans d'autres conditions, pour régler et tester la détection locale (voir design, questions ouvertes).
