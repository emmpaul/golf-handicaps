"use client";

import { CameraIcon, ImageIcon } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import { Pending } from "@/components/ui/pending";
import { cn } from "@/lib/utils";
import { decodePhoto } from "./decode-photo";
import { UnreadablePhoto } from "./unreadable-photo";

/**
 * Libellé stylé en bouton autour d'un champ fichier masqué (`sr-only`) : le champ garde le
 * focus clavier, dont le contour s'affiche sur le bouton.
 */
const PICK_BUTTON =
  "cursor-pointer focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50";

type Step = "pick" | "preparing" | "sending" | "unreadable";

/** Attentes affichées dans la région `Pending`, rien aux autres étapes. */
const PENDING_LABEL: Partial<Record<Step, string>> = {
  preparing: "Préparation de la photo…",
  sending: "Envoi de la photo…",
};

/** Envoie la seule photo : le worker cherche le cadrage. */
async function enqueue(photo: Blob): Promise<boolean> {
  const form = new FormData();
  form.set("photo", photo, "carte.jpg");
  const response = await fetch("/api/imports", { method: "POST", body: form });
  return response.ok;
}

/**
 * Envoi d'une photo : décodage et réencodage JPEG dans le navigateur, puis mise en file du
 * cadrage et de la lecture, sans étape de cadrage. Rend la main tout de suite pour la photo
 * suivante.
 */
export function ImportFlow({ onQueued }: { onQueued: () => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [message, setMessage] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    // Décodage et réduction à 3000 px : une à deux secondes sur téléphone.
    setStep("preparing");
    let blob: Blob;
    try {
      blob = await decodePhoto(file);
    } catch {
      setStep("unreadable");
      return;
    }
    setStep("sending");
    const queued = await enqueue(blob).catch(() => false);
    setStep("pick");
    if (queued) {
      setMessage("Lecture en file d'attente. Tu peux envoyer la photo suivante.");
      onQueued();
    } else {
      setMessage("L'envoi a échoué, réessaie.");
    }
  }

  /** Passe le fichier reçu à `choose`, puis vide le champ pour pouvoir rechoisir le même. */
  function pickFrom(event: ChangeEvent<HTMLInputElement>) {
    void choose(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pointeur grossier (téléphone, tablette) : ouvre directement l'appareil photo arrière. */}
      <label
        className={cn(
          buttonVariants({ size: "lg" }),
          PICK_BUTTON,
          "hidden md:h-11 pointer-coarse:inline-flex",
        )}
      >
        <CameraIcon aria-hidden="true" />
        Prendre une photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={pickFrom}
        />
      </label>
      {/* Champ natif (« Choose File ») remplacé par un bouton ; son nom reste « Photo de la carte ». */}
      <Field>
        <FieldTitle className="sr-only">Photo de la carte</FieldTitle>
        <label className={cn(buttonVariants({ variant: "outline" }), PICK_BUTTON, "md:w-fit")}>
          <ImageIcon aria-hidden="true" />
          Choisir une photo
          <input
            type="file"
            accept="image/*"
            aria-label="Photo de la carte"
            aria-describedby="photo-description"
            className="sr-only"
            onChange={pickFrom}
          />
        </label>
        <FieldDescription id="photo-description">
          Photo de l'écran de fin de round, prise au téléphone.
        </FieldDescription>
      </Field>
      <Pending label={PENDING_LABEL[step] ?? null} orb={step === "sending" ? "send" : "prepare"} />
      {message ? (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      ) : null}
      {step === "unreadable" ? <UnreadablePhoto /> : null}
    </div>
  );
}
