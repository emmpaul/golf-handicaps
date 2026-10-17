# Design

## Context

Motivation : voir `proposal.md`. Comportements : voir `specs/`.

État actuel, issu de `add-golf-handicap-tracker` :
- Le gestionnaire `ocr-scorecard` (`src/jobs/ocr-scorecard.ts`) lit la photo, appelle `readScorecard(photo, corners)` et enregistre le brouillon. L'import passe ensuite à « Prêt à vérifier ».
- `readScorecard` redresse le panneau avec `rectifyPanel` : image en niveaux de gris de 2400×1224 px. Il lit ensuite cases et zones de texte.
- Les contrôles de cohérence (`src/scorecard/checks.ts`) s'appliquent à un `RoundForm`, c'est-à-dire un brouillon plus l'association des joueurs. Ils produisent des `Problem` avec des clés de case (`par:3`, `player0:out`…). Les distances ne sont pas contrôlées.
- Un job qui lève est relancé, puis passe en « Échec » après 2 tentatives.

Contraintes de Manu :
- Coût minimal.
- Modèle Claude Opus 5.5.
- Déclenchement automatique dans le worker.
- Plafond mensuel.
- Envoi du panneau redressé seulement.
- TDD et jscpd à 0 %, comme pour tout le projet.

## Goals / Non-Goals

**Goals :**
- Un seul appel par carte en repli, borné en coût, sans jamais dégrader le cas où la lecture locale réussit.
- Une IA testable sans réseau : le client Anthropic est un collaborateur injecté.

**Non-Goals :**
- Remplacer la lecture locale, ou appeler l'IA quand le brouillon est déjà sans problème.
- Associer les joueurs avec l'IA : les alias restent ceux de la spec `players`.
- Apprendre de nouveaux modèles de chiffres à partir des réponses de l'IA.
- Un bouton « relancer l'IA » dans l'UI.
- Le Batch API : la latence d'un lot, jusqu'à 24 h, ne convient pas à un import qu'on veut vérifier tout de suite.

## Decisions

### 1. Contrôles du brouillon, sans association de joueurs
Le module partagé `src/scorecard/checks.ts` expose une fonction `checkDraft(draft)`, en plus de `checkRoundForm(form)`. Elle renvoie les mêmes `Problem` et les mêmes clés de case, sauf les problèmes liés aux joueurs (« Ligne sans joueur », joueur en double) et à la date. `checkRoundForm` réutilise `checkDraft` et ajoute les problèmes de joueurs. On n'a donc qu'une seule définition de chaque contrôle, sans duplication. Le déclenchement (spec « Déclenchement uniquement en repli ») revient à `checkDraft(draft).length > 0`.
*Alternative* : un contrôle séparé « cases nulles » dans le worker, écarté. Il ignorerait les totaux faux et dupliquerait la logique.

### 2. Étape de repli dans le gestionnaire, derrière une interface
Nouveau module `src/ai/` :
- `completeDraft(panelJpeg): Promise<AiCard>` derrière une interface `DraftCompleter`. L'implémentation `ClaudeDraftCompleter` utilise `@anthropic-ai/sdk`.
- `mergeDraft(local, ai, problems)` : fonction pure. Elle renvoie le brouillon fusionné et la liste des clés de case venues de l'IA.
- `AiBudget` : lit et écrit `ai_usage`, et dit si un appel est permis.

`createJobHandlers` reçoit un `completer` optionnel. Il vaut `null` quand `ANTHROPIC_API_KEY` est absente. Après `readScorecard`, le gestionnaire :
1. calcule `checkDraft`, et s'arrête s'il n'y a aucun problème ou aucun `completer` ;
2. demande au budget s'il reste de quoi faire un appel, sinon note « Budget IA du mois atteint » ;
3. appelle l'IA et fusionne ;
4. enregistre le brouillon, la provenance et le message, puis passe l'import à « Prêt à vérifier ».

Toute erreur de l'étape 3 est attrapée dans le gestionnaire : on garde le brouillon local et le message « Complétion IA indisponible ». Elle ne remonte jamais au runner, donc elle ne consomme pas de tentative de job.
`readScorecard` renvoie aussi le panneau redressé (`{ draft, panel }`), pour ne pas redresser deux fois.

### 3. Requête Claude
- **Modèle** : `claude-opus-5-5`. Avec `output_config.effort: "low"`, on limite la réflexion et donc les tokens de sortie, qui sont le poste principal du coût. Sur ce modèle, la réflexion ne peut pas être coupée.
- **Image** : le panneau redressé est encodé en JPEG avec sharp, qualité 85, ramené à 1568 px sur le grand côté (1568×800), soit environ 1 700 tokens d'image. Il est envoyé en base64 : on n'utilise pas la Files API, puisqu'il n'y a qu'un seul usage par image.
- **Sortie structurée** : `output_config.format` avec un schéma JSON strict. Il décrit `courseName`, `tees`, `par` (18 valeurs + out/in/total), `strokeIndex` (18), `distance` (18 + totaux), et `players[]` (nom, 18 scores, totaux). Chaque valeur peut être `null` quand elle est illisible. On utilise le helper de parsing du SDK, et zod valide la réponse avant la fusion. Pas de tool use forcé, qui est refusé sur ce modèle.
- **Prompt** : un `system` fixe décrit la carte GSPro (lignes, colonnes, totaux, cases encadrées ou cerclées) et demande de recopier ce qui est affiché, sans corriger. Il n'y a pas de cache : la requête est unique et le préfixe est trop court pour être mis en cache.
- **Bornes** : `max_tokens: 4000` et un timeout de 60 s. Les retries du SDK sont laissés à 2.
- **Refus** : on ajoute le paramètre serveur `fallbacks: "default"`, avec le beta `server-side-fallback-2026-07-01`. On vérifie `stop_reason` avant de lire le contenu. Un `refusal` ou un `max_tokens` est traité comme une erreur : la complétion est marquée indisponible.

### 4. Fusion cellule par cellule
Les cases éligibles sont l'union des `cells` de tous les `Problem` de `checkDraft`. Pour un problème de somme, cela inclut toute la ligne concernée et son total : on ne sait pas quelle case est fausse. Pour chacune, si l'IA donne une valeur non nulle, elle remplace la valeur locale et la clé entre dans `aiCells`. Les autres cases restent intactes (spec « Fusion avec la lecture locale »). Les lignes de joueur sont alignées par leur rang, pas par leur nom. Si l'IA voit plus de lignes que la lecture locale, les lignes en plus sont ajoutées entières, et marquées IA.
*Alternative* : prendre toute la carte de l'IA dès qu'elle passe les contrôles, écartée. Une case correcte lue localement pourrait être remplacée par une erreur de l'IA.

### 5. Provenance et messages dans `imports`
Migration additive sur `imports` :
- `ai_cells` : JSON, liste des clés de case, `null` par défaut.
- `ai_note` : texte, `null` ou l'un des deux messages de la spec.

L'écran de correction reçoit `aiCells`. `GridCell` ajoute une classe visible (fond teinté et petite pastille) et `aria-description="complété par l'IA"`. L'état de l'éditeur retire une clé de `aiCells` dès que la case est modifiée. `ai_note` s'affiche au-dessus de la grille.

### 6. Budget en micro-dollars
Nouvelle table `ai_usage` : `id`, `created_at`, `month` (`YYYY-MM`, heure de Montréal), `model`, `input_tokens`, `output_tokens`, `cost_micro_usd`.
- **Tarifs** : constantes dans `src/ai/pricing.ts`, soit 4 $ et 20 $ par million de tokens pour `claude-opus-5-5`. Ils sont testés avec des valeurs écrites à la main.
- **Coût d'un appel** : `input × 4 + output × 20` micro-dollars, avec les tokens réellement facturés renvoyés dans `usage`, réflexion comprise.
- **Garde avant appel** : `spent(month) + MAX_CALL_COST <= budget`. `MAX_CALL_COST` correspond au pire cas, 2 000 tokens d'entrée et `max_tokens` 4 000 en sortie, soit 0,088 $.
- **Plafond** : `AI_MONTHLY_BUDGET_USD` (défaut 1), validé par zod comme nombre positif.
- **Concurrence** : un seul worker tourne. On écrit l'usage après chaque appel, même en cas d'erreur de parsing, puisque l'appel est quand même facturé.

### 7. Configuration
`src/lib/env.ts` ajoute `ANTHROPIC_API_KEY`, optionnelle, et `AI_MONTHLY_BUDGET_USD`. Le web n'en a pas besoin : seul le worker appelle l'IA. Le README et `.env.example` documentent les deux variables, et rappellent qu'il faut aussi fixer une limite de dépense dans la console Anthropic.

## Risks / Trade-offs

- [L'IA invente une valeur plausible mais fausse] → seules les cases en problème sont remplacées, elles sont marquées, les contrôles de somme se recalculent et la correction reste obligatoire.
- [Les tarifs changent] → ils sont isolés dans `pricing.ts`. La limite côté console Anthropic sert de deuxième barrière.
- [Les tokens de réflexion font monter le coût] → effort `low`, `max_tokens` borné, coût réel mesuré par l'usage, et plafond.
- [Données personnelles chez Anthropic : prénoms et scores] → seul le panneau redressé part. La fonction est désactivée sans clé, et le README le signale.
- [Le worker est bloqué pendant l'appel] → timeout de 60 s, un appel par carte au maximum. Les autres imports attendent, ce qui est acceptable pour quelques cartes par semaine.

## Migration Plan

1. Déployer la nouvelle image : la migration additive (`ai_usage`, `imports.ai_cells`, `imports.ai_note`) s'applique au démarrage du web.
2. Ajouter `ANTHROPIC_API_KEY` au service worker dans Dokploy, et éventuellement `AI_MONTHLY_BUDGET_USD`, puis redéployer le worker. Fixer aussi une limite mensuelle dans la console Anthropic.
3. Retour arrière : retirer la clé suffit à désactiver la fonction. Sinon, redéployer le tag précédent : les colonnes ajoutées sont ignorées par l'ancien code.
