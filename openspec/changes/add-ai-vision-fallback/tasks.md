# Tasks

Règle pour tout le change : TDD. Chaque comportement de production commence par un test rouge, qui échoue pour la raison qu'il nomme, avec des valeurs attendues écrites à la main d'après les specs. Le client Anthropic est un collaborateur simulé ; le code testé tourne réellement. `pnpm jscpd` reste à 0 %, chaque commit passe commitlint, et aucun test n'appelle l'API réelle.

## 1. Dépendance et configuration

- [x] 1.1 Installer `@anthropic-ai/sdk` à sa dernière version stable, en version exacte (`pnpm view`, puis `pnpm add -E`). Vérifier : `pnpm check:pins` passe.
- [x] 1.2 TDD : `src/lib/env.ts` accepte `ANTHROPIC_API_KEY` (optionnelle) et `AI_MONTHLY_BUDGET_USD` (nombre > 0, défaut 1). Tests : absente, la clé donne `null` et le budget 1 ; `AI_MONTHLY_BUDGET_USD=abc` lève une erreur dont le message contient `AI_MONTHLY_BUDGET_USD`. Documenter les deux variables dans `.env.example`. Vérifier : `pnpm test` passe.

## 2. Contrôles du brouillon (spec `scorecard-ai-completion`, déclenchement)

- [x] 2.1 TDD : `checkDraft(draft)` dans `src/scorecard/checks.ts`. Brouillon de référence : 0 problème. Score de Gab au trou 9 à `null` : exactement 1 problème, sur la case `player0:9`. Gab 5,5,3,5,4,4,4,3,3 avec OUT 38 : le problème « Somme aller 36 ≠ OUT 38 ». Date `null` : 0 problème. Distance `null` : 0 problème. Ensuite, refactorer `checkRoundForm` pour qu'il s'appuie sur `checkDraft`. Vérifier : tous les tests existants des contrôles restent verts et `pnpm jscpd` sort à 0.

## 3. Budget (spec `scorecard-ai-completion`, plafond)

- [x] 3.1 Migration additive : table `ai_usage`, colonnes `imports.ai_cells` (JSON) et `imports.ai_note` (texte). Vérifier : le test de migration sur base vide passe, et une base existante garde ses imports.
- [x] 3.2 TDD : `src/ai/pricing.ts`. Pour 1 700 tokens en entrée et 900 en sortie sur `claude-opus-5-5`, le coût vaut exactement 24 800 micro-dollars. `MAX_CALL_COST` vaut 88 000.
- [x] 3.3 TDD : `AiBudget`. Avec un plafond de 1 $ et 950 000 micro-dollars dépensés en 2026-10, un appel est refusé. Le même cumul en 2026-09, avec une date courante en 2026-10, l'autorise. Un usage enregistré augmente le cumul du mois d'exactement son coût. Le mois se calcule à l'heure de Montréal : le 2026-10-31 à 23 h 30 HAE compte en 2026-10.

## 4. Fusion (spec `scorecard-ai-completion`, fusion)

- [x] 4.1 TDD : `mergeDraft(local, ai, problems)`. Les cas suivants viennent de la spec :
  - Gab trou 9 `null` en local et 5 par l'IA : on obtient 5, et `aiCells` vaut exactement `["player0:9"]`.
  - Manu trou 1 à 7 en local, sans problème sur la ligne, et 1 par l'IA : on garde 7, et `aiCells` est vide.
  - Une case en problème que l'IA rend `null` : la valeur locale est gardée et la case n'est pas marquée.
  - L'IA voit une 3e ligne absente en local : la ligne est ajoutée et toutes ses cases sont marquées.

## 5. Client Claude (spec `scorecard-ai-completion`, données envoyées)

- [x] 5.1 TDD : `ClaudeDraftCompleter`, testé contre un faux client injecté. La requête doit contenir :
  - le modèle `claude-opus-5-5`, avec effort `low` ;
  - une seule image, en JPEG base64, de 1568×800 px, produite à partir du panneau redressé de la photo de référence ;
  - le schéma de sortie et `max_tokens` 4000 ;
  - ni paramètre `fallbacks`, ni `betas`, ni `thinking`.

  Les options de requête portent `timeout` 60000 et `maxRetries` 1.

  Réponses du faux client : une réponse valide est parsée en `AiCard` ; `stop_reason` `refusal` ou `max_tokens` lève une erreur typée ; un JSON non conforme au schéma zod lève aussi une erreur. Dans tous les cas, l'usage est renvoyé avec la réponse ou l'erreur.
- [x] 5.2 `readScorecard` renvoie `{ draft, panel }`. Adapter ses appelants (gestionnaire, `ocr:debug`). Vérifier : le test de lecture complète de la photo de référence passe toujours, à l'identique.

## 6. Repli dans le worker (spec `scorecard-ai-completion`, déclenchement et blocage)

- [x] 6.1 TDD : le gestionnaire `ocr-scorecard`, avec la vraie lecture locale de la photo de référence et un faux completer. Cas à couvrir :
  - Brouillon sans problème : 0 appel, `ai_note` à `null`.
  - Lecture locale simulée qui laisse `player0:9` à `null`, IA qui lit 5 : 1 appel. L'import est « Prêt à vérifier », avec 5 dans le brouillon et `ai_cells` à `["player0:9"]`.
  - Budget épuisé : 0 appel, et `ai_note` vaut « Budget IA du mois atteint ».
  - Completer qui lève : l'import est « Prêt à vérifier » avec le brouillon local, `ai_note` vaut « Complétion IA indisponible », et le job est `done` en 1 tentative.
  - Sans clé : 0 appel et aucune note.
  - L'usage de chaque appel, réussi ou non, est enregistré.
- [x] 6.2 `src/worker.ts` construit le completer seulement si `ANTHROPIC_API_KEY` est définie. Vérifier : sans la clé, `pnpm dev` démarre le worker sans erreur et sans message sur l'IA. Un import de la photo de référence arrive à « Prêt à vérifier » comme avant.

## 7. Écran de correction (spec `scorecard-ai-completion`, marquage)

- [x] 7.1 TDD (e2e) : un import préparé avec `ai_cells = ["player0:9"]` et `ai_note`.
  - La case Gab trou 9 porte la marque visible et la description accessible « complété par l'IA » ; aucune autre case ne la porte.
  - La note s'affiche au-dessus de la grille.
  - Une fois la case modifiée, la marque disparaît.

  Vérifier : `pnpm e2e` passe sur Chromium et WebKit iPhone.

## 8. Documentation et vérification d'ensemble

- [x] 8.1 README : section « Complétion IA ». Elle couvre quand l'IA est appelée, ce qui est envoyé, le coût estimé (environ 2 ¢ par carte difficile), le plafond, la limite à fixer dans la console Anthropic, et les variables à ajouter au service worker dans Dokploy. Vérifier : les variables du README correspondent à `.env.example`.
- [x] 8.2 Passer les contrôles du projet : `pnpm check:pins`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm e2e`, `pnpm jscpd`, `pnpm build`, `docker build`. Vérifier : tout est vert, et `grep -r "api.anthropic" tests/` ne trouve aucun appel réseau réel.

## 9. Vérification réelle (humain)

- [ ] 9.1 Avec une vraie clé et un plafond de 1 $ : importer une photo volontairement mauvaise (reflet ou biais). Vérifier que les cases marquées IA sont correctes, et que la ligne `ai_usage` donne un coût cohérent avec le tableau de bord Anthropic (à ±10 %).

## Workflow follow-up

- Archiver `add-golf-handicap-tracker` avant d'archiver ce change : la spec `scorecard-import` modifiée ici doit déjà exister dans `openspec/specs/`.
- Archiver ce change (`/opsx:archive`) une fois la revue faite et la vérification 9.1 validée.
