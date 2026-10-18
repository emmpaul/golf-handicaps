# Proposal

## Why

Un import raté ou en double reste pour toujours dans la liste des imports : photo floue, mauvaise carte, photo envoyée deux fois, import en « Échec » qu'on ne veut pas corriger. Rien ne permet de le retirer, et sa photo reste sur le disque. Quand on supprime un round importé, c'est pire : son import revient « Prêt à vérifier », comme si la carte n'avait jamais été enregistrée, et sa photo reste aussi sur le disque. Côté joueurs, un alias appris par erreur (ligne associée au mauvais joueur) associe ce nom au mauvais joueur à chaque import suivant, et on ne peut pas le retirer.

## What Changes

- **Suppression d'un import** : un import pas encore enregistré en round (« En attente », « Prêt à vérifier » ou « Échec ») se supprime depuis la liste des imports, après une confirmation. Sa photo est effacée du disque et son job de lecture en file est retiré. Un import en « Lecture en cours » ou déjà enregistré en round est refusé.
- **Nouvelle route** `DELETE /api/imports/:id` : 204 une fois supprimé, 404 « Import introuvable », 409 « Lecture en cours » ou « Cette carte est déjà enregistrée ».
- **Suppression d'un round importé** : le round emporte maintenant son import et sa photo. L'import disparaît de la liste au lieu de revenir « Prêt à vérifier ». Le texte de confirmation le dit.
- **Retrait d'un alias** : sur la page Joueurs, chaque alias a un bouton « Retirer ». Pas de confirmation : l'alias se réapprend à la prochaine association manuelle.
- Hors périmètre : supprimer un joueur (il garde ses rounds et son historique d'index), supprimer un import enregistré sans son round, supprimer depuis l'écran de correction.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `scorecard-import` : nouvelle exigence « Suppression d'un import », qui couvre aussi l'effacement de sa photo. « Conservation de la photo » n'est pas modifiée ici, parce que `store-photos-as-webp`, pas encore archivé, la réécrit déjà.
- `rounds` : « Suppression d'un round » supprime aussi l'import et la photo d'un round importé.
- `players` : nouvelle exigence « Retrait d'un alias ».

## Impact

- **Code** :
  - `src/jobs/imports.ts` : nouvelle `deleteImport(db, dataDir, id)`, sur le modèle de `recropImport` (résultat typé, une transaction).
  - `src/app/api/imports/[id]/route.ts` : handler `DELETE`.
  - `src/server/rounds/edit.ts` : `deleteRound` supprime les imports du round et renvoie le chemin de la photo à effacer ; `src/server/rounds/http.ts` efface le fichier après la transaction.
  - `src/components/import/import-list.tsx` : bouton « Supprimer » et dialogue de confirmation, sur le modèle de `src/components/rounds/delete-round.tsx`.
  - `src/server/players/aliases.ts`, `src/app/(app)/players/actions.ts` et `page.tsx` : retrait d'un alias.
- **Base** : aucune migration. Les clés étrangères existantes suffisent (`imports.round_id` reste `on delete set null`, l'import est supprimé explicitement avant le round).
- **Disque** : les photos des imports et rounds supprimés sont effacées. Les photos déjà orphelines (rounds supprimés avant ce change) restent ; voir design, questions ouvertes.
- **Irréversible** : un import ou un round supprimé ne se récupère pas, photo comprise. La confirmation le dit.
