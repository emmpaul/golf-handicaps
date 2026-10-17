"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pending } from "@/components/ui/pending";
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
const ACTIONS = cn("flex flex-wrap items-center gap-2", SIDE_BOTTOM);

/** Attente en cours : calcul de l'aperçu redressé ou envoi des coins validés. */
type Busy = "rectify" | "send";

const BUSY_LABEL = {
  rectify: "Redressement de la photo…",
  send: "Envoi de la photo…",
} as const satisfies Record<Busy, string>;

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
  const [busy, setBusy] = useState<Busy | null>(null);

  async function during(kind: Busy, task: () => Promise<void>) {
    setBusy(kind);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  }

  const launchCorners = () => void during("send", () => onLaunch(corners));
  const showPreview = () =>
    void during("rectify", async () => setPreview(await rectifyPreview(photoUrl, corners)));
  // Région montée avec la barre d'actions, avant le clic : seul son contenu change.
  const pending = <Pending label={busy && BUSY_LABEL[busy]} orb={busy ?? "send"} />;

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
          <div className={ACTIONS}>
            <Button size="lg" disabled={busy !== null} onClick={launchCorners}>
              Lancer la lecture
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={busy !== null}
              onClick={() => setPreview(null)}
            >
              Recadrer
            </Button>
            {pending}
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
          <div className={ACTIONS}>
            <Button size="lg" disabled={busy !== null} onClick={showPreview}>
              Valider le cadrage
            </Button>
            {pending}
          </div>
        </div>
      )}
    </div>
  );
}
