"use client";

import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";

/**
 * Suppression d'un import pas encore enregistré en round, après confirmation (design,
 * décision 6). Supprimé ou refusé (lecture commencée entre-temps), la liste se recharge :
 * l'import disparaît, ou son nouvel état montre pourquoi il reste.
 */
export function DeleteImport({ importId, onDone }: { importId: number; onDone: () => void }) {
  return (
    <ConfirmDelete
      trigger={<Button variant="ghost" size="sm" className="max-md:min-h-11" />}
      title="Supprimer cet import ?"
      description="La photo et la correction en cours seront effacées."
      url={`/api/imports/${importId}`}
      pendingLabel="Suppression de l'import…"
      onDeleted={onDone}
      onRefused={onDone}
    />
  );
}
