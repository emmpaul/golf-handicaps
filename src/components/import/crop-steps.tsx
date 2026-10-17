"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Corners } from "@/ocr/corners";
import { CornerEditor } from "./corner-editor";
import { rectifyPreview } from "./rectify-preview";

/**
 * Pile sur téléphone ; quand la place le permet (conteneur large, comme la page de
 * recadrage sur ordinateur), la photo à gauche et les consignes et boutons à droite.
 */
const LAYOUT =
  "grid grid-cols-1 gap-3 @4xl:grid-cols-[minmax(0,auto)_16rem] @4xl:grid-rows-[auto_1fr] @4xl:justify-start";
const MAIN = "@4xl:col-start-1 @4xl:row-span-2 @4xl:row-start-1";
const SIDE_TOP = "@4xl:col-start-2 @4xl:row-start-1";
const SIDE_BOTTOM = "@4xl:col-start-2 @4xl:row-start-2 @4xl:self-start";

/**
 * Cadrage des 4 coins sur `photoUrl`, aperçu redressé, puis « Lancer la lecture » qui
 * appelle `onLaunch` avec les coins validés. Sert à l'envoi d'une photo et au recadrage
 * d'un import en échec.
 */
export function CropSteps({
  photoUrl,
  initialCorners,
  onLaunch,
}: {
  photoUrl: string;
  initialCorners: Corners;
  onLaunch: (corners: Corners) => Promise<void>;
}) {
  const [corners, setCorners] = useState(initialCorners);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function during(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  const launchCorners = () => void during(() => onLaunch(corners));
  const showPreview = () =>
    void during(async () => setPreview(await rectifyPreview(photoUrl, corners)));

  return (
    <div className="@container">
      {preview ? (
        <div className={LAYOUT}>
          {/* biome-ignore lint/performance/noImgElement: aperçu calculé dans le navigateur. */}
          <img
            src={preview}
            alt="Carte redressée"
            className={cn("max-h-[70vh] w-auto max-w-full self-start rounded-lg border", MAIN)}
          />
          <div className={cn("flex flex-wrap gap-2", SIDE_BOTTOM)}>
            <Button size="lg" disabled={busy} onClick={launchCorners}>
              Lancer la lecture
            </Button>
            <Button size="lg" variant="outline" disabled={busy} onClick={() => setPreview(null)}>
              Recadrer
            </Button>
          </div>
        </div>
      ) : (
        <div className={LAYOUT}>
          <p className={cn("text-sm text-muted-foreground", SIDE_TOP)}>
            Place les 4 poignées sur les coins du panneau : du coin haut gauche du bandeau sombre au
            coin bas droit de la bande « ROUND SETTINGS ».
          </p>
          <div className={MAIN}>
            <CornerEditor photoUrl={photoUrl} corners={corners} onChange={setCorners} />
          </div>
          <Button size="lg" className={SIDE_BOTTOM} disabled={busy} onClick={showPreview}>
            Valider le cadrage
          </Button>
        </div>
      )}
    </div>
  );
}
