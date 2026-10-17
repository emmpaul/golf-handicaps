"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { Corners } from "@/ocr/corners";
import { INITIAL_CORNERS } from "./corner-editor";
import { CropSteps } from "./crop-steps";

/**
 * Recadrage d'un import en échec sur sa photo enregistrée, à partir de ses anciens coins,
 * puis retour à la liste des imports.
 */
export function RecropImport({ id, corners }: { id: number; corners: Corners | null }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  async function launch(next: Corners) {
    const response = await fetch(`/api/imports/${id}/corners`, {
      method: "POST",
      body: JSON.stringify(next),
    });
    if (response.ok) router.push("/import");
    else setFailed(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {failed ? (
        <Alert variant="destructive">
          <AlertTitle>L'envoi a échoué, réessaie.</AlertTitle>
        </Alert>
      ) : null}
      <CropSteps
        photoUrl={`/api/imports/${id}/photo`}
        initialCorners={corners ?? INITIAL_CORNERS}
        onLaunch={launch}
      />
    </div>
  );
}
