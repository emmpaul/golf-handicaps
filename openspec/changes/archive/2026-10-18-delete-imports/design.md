# Design

## Context

- Un import (`imports`) a sa photo sous `DATA_DIR/uploads/<uuid>.webp`. À l'enregistrement d'un round depuis un import, `rounds.photo_path` reçoit le même chemin (`src/server/rounds/save.ts`) : un fichier peut être référencé par les deux tables.
- `imports.round_id` référence `rounds.id` avec `on delete set null`. Aujourd'hui, `deleteRound` (`src/server/rounds/edit.ts`) supprime le round : son import repasse « Prêt à vérifier » sans round, et la photo reste.
- La lecture passe par un job `ocr-scorecard` (`jobs.payload = { importId }`, JSON). Le worker réserve le job (`running`), passe l'import en `reading`, puis relit l'import ; un import absent lève « Import introuvable », le job est retenté puis passe `failed`, et `onFailed` met à jour une ligne qui n'existe plus (aucun effet).
- `recropImport` (`src/jobs/imports.ts`) et `saveCorrection` (`src/server/imports/correction.ts`) montrent le modèle déjà utilisé pour les écritures conditionnelles sur un import : une transaction, un résultat typé (`"not-found"`, `"reading"`, `"already-saved"`…), traduit en HTTP par la route.
- `DeleteRound` (`src/components/rounds/delete-round.tsx`) est le modèle d'UI : `AlertDialog`, `Pending`, `fetch(..., { method: "DELETE" })`, puis `router.refresh()`.
- Les alias sont dans `player_aliases`, uniques sans casse. La page Joueurs les affiche en texte (« Alias : A, B ») et les modifie par server actions (`src/app/(app)/players/actions.ts`).

## Goals / Non-Goals

**Goals:**
- Aucune photo orpheline créée par une suppression faite après ce change.
- Aucune lecture lancée sur un import supprimé.

**Non-Goals:**
- Nettoyer les photos déjà orphelines (voir Questions ouvertes).
- Corbeille ou annulation : la suppression est définitive.
- Suppression en lot de plusieurs imports.

## Decisions

### 1. `deleteImport` : une transaction conditionnelle, résultat typé

`deleteImport(db, id): DeleteImportResult`, avec `"deleted" | "not-found" | "reading" | "already-saved"`, sur le modèle de `recropImport`. Dans une transaction :

1. Lire `status`, `round_id`, `photo_path` de l'import. Absent : `"not-found"`. `round_id` non nul : `"already-saved"`. `status = reading` : `"reading"`.
2. Supprimer les jobs `ocr-scorecard` en `queued` de cet import (`json_extract(payload, '$.importId') = id`).
3. Supprimer l'import.

La fonction renvoie aussi le chemin de la photo à effacer (décision 3). SQLite sérialise les écritures : un enregistrement de round ou un recadrage concurrent passe avant ou après, jamais au milieu.

- `already-saved` est testé avant `reading`. Un import enregistré est toujours `ready`, donc l'ordre ne change que le message, et « déjà enregistrée » est le plus utile.
- Alternative écartée : laisser le job en file et compter sur « Import introuvable ». Il ferait 2 tentatives inutiles et laisserait un job `failed` avec une erreur trompeuse dans `jobs`.

### 2. Job déjà réservé mais import pas encore en `reading`

Entre `claimNextJob` et le premier `setImport(..., "reading")`, le job est `running` et l'import encore `queued`. Une suppression dans cette fenêtre passe : le job `running` n'est pas supprimé, il échoue sur « Import introuvable », puis passe `failed` sans effet. Ce cas est accepté, pas bloqué : la fenêtre ne dure que le temps d'une requête SQLite, et le résultat est déjà correct (import supprimé, aucune lecture écrite). Bloquer en testant aussi les jobs `running` demanderait de refuser un import « En attente » pour une raison que l'utilisateur ne voit pas.

### 3. Effacer la photo après la transaction, seulement si plus rien ne la référence

Le fichier est effacé (`rm(..., { force: true })`) après le commit, jamais dedans : une transaction annulée ne doit pas avoir effacé un fichier encore référencé. Avant d'effacer, une requête vérifie qu'aucun import ni round restant ne porte ce `photo_path`. Normalement un seul import et au plus un round le portent, mais un import réenregistré après la suppression de son round, avant ce change, peut avoir laissé des références croisées.

- Un `rm` qui échoue (fichier déjà absent, droits) est ignoré : la ligne est supprimée, au pire la photo reste orpheline. Pas de 500 pour un fichier.
- Une fonction commune `removeUnreferencedPhoto(db, dataDir, photoPath)` sert aux deux suppressions (import et round), pour que `pnpm jscpd` reste à 0 %.

### 4. Supprimer un round emporte son import

`deleteRound` supprime, dans sa transaction et avant le round, les imports dont `round_id` est ce round, et renvoie `rounds.photo_path`. La photo est effacée ensuite par la décision 3. `deleteRoundRequest` reçoit `dataDir` comme `createImport`, et la route le lit dans `getEnv().DATA_DIR`.

- La clé étrangère reste `on delete set null` : pas de migration, et l'import est supprimé explicitement, donc l'effet est visible dans le code.
- Alternative écartée : passer la clé en `on delete cascade`. Il faudrait reconstruire la table `imports` dans SQLite (migration lourde), et la photo devrait quand même être effacée par le code.
- Le texte du dialogue devient : « Il sera retiré de l'historique, avec sa photo et son import, et les index de ses joueurs seront recalculés. »

### 5. Route `DELETE /api/imports/:id`

Ajoutée à `src/app/api/imports/[id]/route.ts`, à côté du `GET`. Un id non numérique (`/^\d+$/`, comme la route `corners`) ou absent répond 404 « Import introuvable ». `reading` et `already-saved` répondent 409 avec les messages de `saveCorrection` (« Lecture en cours », « Cette carte est déjà enregistrée »). En cas de succès, 204. Les messages sont repris de `correction/route.ts` par une table partagée, pas recopiés.

### 6. UI de la liste des imports

`DeleteImport` (nouveau, `src/components/import/delete-import.tsx`) : `AlertDialog` « Supprimer cet import ? », description « La photo et la correction en cours seront effacées. », boutons « Annuler » et « Supprimer ». Bouton déclencheur en `variant="ghost"`, `size="sm"`, libellé « Supprimer », à droite des actions existantes de `ImportAction`, pour un import sans round et dont l'état n'est pas `reading`. Après un 204, la liste se recharge (`keepLoading` une fois, comme après un envoi). Sur 409, le dialogue se ferme et la liste se recharge : l'état affiché montre pourquoi.

Le composant reprend la structure de `DeleteRound`. Si la duplication dépasse le seuil de `jscpd`, extraire un `ConfirmDelete` partagé (titre, description, url, `onDeleted`).

### 7. Retrait d'un alias

`removeAlias(db, playerId, alias)` supprime la ligne `player_aliases` de ce joueur, alias comparé sans casse (comme `learnAlias`). Un alias absent ne fait rien (pas d'erreur : double clic, deux onglets). Server action `removeAliasAction` dans `actions.ts`, avec `revalidatePath("/", "layout")` comme les autres.

Sur la page Joueurs, la ligne « Alias : A, B » devient une liste : chaque alias avec un petit bouton « Retirer » (`aria-label="Retirer l'alias A de Manu"`), dans un `<form action>` qui fonctionne sans JavaScript. « Aucun » (`NO_VALUE`) quand la liste est vide. Pas de confirmation (spec `players`).

- `data-testid="player-aliases"` reste sur le conteneur pour les e2e existants. Leur assertion de texte change, et ils sont mis à jour.

## Risks / Trade-offs

- [Suppression définitive d'une photo par erreur] → Confirmation obligatoire, description explicite, et pas de suppression d'un import déjà enregistré en round (il faut supprimer le round, qui a sa propre confirmation).
- [Race worker : import supprimé juste après la réservation de son job] → Accepté (décision 2) : le job finit `failed` sans effet. Couvert par un test du gestionnaire `ocr-scorecard` sur un import absent.
- [Photo effacée encore référencée] → Vérification des références avant `rm` (décision 3), testée avec un round et un import qui partagent un chemin.
- [Changement de comportement pour les rounds importés] → Un round supprimé ne peut plus être réenregistré depuis son import. C'était un effet de bord jamais spécifié. Le dialogue l'annonce.

## Migration Plan

Aucune migration de base. Déploiement normal ; retour arrière par revert de la PR. Les suppressions faites entre-temps restent faites.

## Open Questions

- Photos déjà orphelines (rounds supprimés avant ce change : leur import est revenu « Prêt à vérifier » et garde la photo, donc ce n'est pas un vrai orphelin). Elles se suppriment maintenant avec l'import. Un nettoyage des fichiers de `uploads/` sans aucune ligne peut venir plus tard, au démarrage comme `convert-photos`, sans changer les specs.
