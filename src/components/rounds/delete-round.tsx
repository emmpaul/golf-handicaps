"use client";

import { useRouter } from "next/navigation";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";

/**
 * Suppression d'un round après confirmation ; son import et sa photo partent avec lui, et les
 * index sont recalculés côté serveur.
 */
export function DeleteRound({ roundId }: { roundId: number }) {
  const router = useRouter();
  return (
    <ConfirmDelete
      trigger={<Button variant="destructive" size="lg" />}
      title="Supprimer ce round ?"
      description="Il sera retiré de l'historique, avec sa photo et son import, et les index de ses joueurs seront recalculés."
      url={`/api/rounds/${roundId}`}
      pendingLabel="Suppression du round…"
      onDeleted={() => {
        router.push("/rounds");
        router.refresh();
      }}
    />
  );
}
