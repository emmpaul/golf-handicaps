"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pending } from "@/components/ui/pending";

/**
 * Suppression après confirmation : `DELETE url`, puis `onDeleted` une fois supprimé. Un refus
 * ferme le dialogue et appelle `onRefused` s'il est donné ; sinon le dialogue reste ouvert.
 */
export function ConfirmDelete({
  trigger,
  title,
  description,
  url,
  pendingLabel,
  onDeleted,
  onRefused,
}: {
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  url: string;
  pendingLabel: string;
  onDeleted: () => void;
  onRefused?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const response = await fetch(url, { method: "DELETE" });
    if (response.ok) return onDeleted();
    setDeleting(false);
    if (!onRefused) return;
    setOpen(false);
    onRefused();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger}>Supprimer</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Pending label={deleting ? pendingLabel : null} orb="send" />
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={() => void remove()}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
