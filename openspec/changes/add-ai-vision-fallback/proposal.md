# Proposal

## Why

La lecture locale (gabarit GSPro, modèles de chiffres, Tesseract) lit parfaitement la carte de référence. Sur une photo moins bonne (reflet, moiré, biais fort), elle laisse des cases vides ou des totaux faux, et il faut tout retaper à la main. Un modèle de vision d'Anthropic peut compléter ces cas. Le coût doit rester négligeable : l'IA ne sert qu'en repli, une seule fois par carte, sous un plafond mensuel.

## What Changes

- Après la lecture locale, le worker vérifie le brouillon : cases vides, et contrôles de cohérence en échec (sommes OUT/IN/TOT, pars, index, scores). Si tout passe, rien ne change et aucun appel n'est fait.
- Sinon, le worker envoie **une seule image** à l'API Claude : le panneau redressé, jamais la photo d'origine. Le modèle Claude Opus 5.5 renvoie la carte complète en JSON structuré.
- Fusion : seules les cases vides ou en défaut reprennent la valeur de l'IA. Les cases lues localement et cohérentes restent telles quelles.
- L'écran de correction marque chaque case remplie par l'IA. La correction reste obligatoire avant d'enregistrer, comme aujourd'hui.
- Plafond de dépense mensuel (1 $ par défaut, réglable). L'app calcule le coût de chaque appel à partir de l'usage renvoyé par l'API. Une fois le plafond atteint, l'import reste en lecture locale seule, avec un message.
- Fonction optionnelle : sans clé `ANTHROPIC_API_KEY`, l'app se comporte exactement comme avant. Une erreur de l'API n'empêche jamais l'import d'arriver à « Prêt à vérifier ».
- **BREAKING (spec)** : l'exigence « Lecture OCR sans service externe » de `scorecard-import` est assouplie. La lecture reste locale, mais le panneau redressé peut partir chez Anthropic dans le cas de repli, si une clé est configurée.

## Capabilities

### New Capabilities

- `scorecard-ai-completion` : complétion par IA d'un brouillon de carte incomplet ou incohérent. Couvre le déclenchement, les données envoyées, la fusion avec la lecture locale, le marquage des cases, le plafond de dépense et le comportement en cas d'erreur.

### Modified Capabilities

- `scorecard-import` : l'exigence « Lecture OCR sans service externe » permet désormais d'envoyer le panneau redressé à l'API Claude, dans le seul cas défini par `scorecard-ai-completion`.

## Impact

- **Ordre** : ce change s'appuie sur les specs de `add-golf-handicap-tracker`. Celui-ci doit être archivé avant, pour que `scorecard-import` existe dans `openspec/specs/`.
- **Code** :
  - `src/jobs/ocr-scorecard.ts` : étape de repli après la lecture locale.
  - Nouveau module `src/ai/` : client, prompt, schéma de sortie, fusion, budget.
  - `src/scorecard/` : contrôles applicables au brouillon, sans association de joueurs.
  - Écran de correction : marquage des cases remplies par l'IA.
- **Base** : nouvelle table `ai_usage` (coût par appel et par mois). Le brouillon garde la provenance de chaque case. Migration additive.
- **Dépendance** : `@anthropic-ai/sdk`, version exacte pinnée.
- **Configuration** : `ANTHROPIC_API_KEY` (optionnelle) et `AI_MONTHLY_BUDGET_USD` (défaut 1). Documentées dans `.env.example` et le README. À ajouter à la main dans les deux services Dokploy, web et worker.
- **Coût estimé** : environ 2 ¢ par carte qui a besoin de l'IA. Moins de 0,20 $ par mois pour une dizaine de cartes difficiles.
- **Confidentialité** : seul le panneau redressé part (noms des joueurs, scores, parcours). La photo d'origine reste sur le volume.
