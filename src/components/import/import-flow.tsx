"use client";

import { CameraIcon } from "lucide-react";
import { type ChangeEvent, useEffect, useState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Corners } from "@/ocr/corners";
import { INITIAL_CORNERS } from "./corner-editor";
import { CropSteps } from "./crop-steps";
import { decodePhoto } from "./decode-photo";
import { UnreadablePhoto } from "./unreadable-photo";

type Photo = { blob: Blob; url: string };

type Step = { kind: "pick" } | { kind: "unreadable" } | { kind: "crop"; photo: Photo };

async function enqueue(photo: Blob, corners: Corners): Promise<boolean> {
  const form = new FormData();
  form.set("photo", photo, "carte.jpg");
  form.set("corners", JSON.stringify(corners));
  const response = await fetch("/api/imports", { method: "POST", body: form });
  return response.ok;
}

/**
 * Envoi d'une photo : décodage et réencodage JPEG dans le navigateur, cadrage des 4 coins,
 * aperçu redressé, puis mise en file de la lecture. Rend la main tout de suite pour la
 * photo suivante.
 */
export function ImportFlow({ onQueued }: { onQueued: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [message, setMessage] = useState<string | null>(null);
  const photoUrl = step.kind === "crop" ? step.photo.url : null;

  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    try {
      const blob = await decodePhoto(file);
      setStep({ kind: "crop", photo: { blob, url: URL.createObjectURL(blob) } });
    } catch {
      setStep({ kind: "unreadable" });
    }
  }

  /** Passe le fichier reçu à `choose`, puis vide le champ pour pouvoir rechoisir le même. */
  function pickFrom(event: ChangeEvent<HTMLInputElement>) {
    void choose(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  async function launch(photo: Photo, corners: Corners) {
    if (await enqueue(photo.blob, corners)) {
      setStep({ kind: "pick" });
      setMessage("Lecture en file d'attente. Tu peux envoyer la photo suivante.");
      onQueued();
    } else {
      setMessage("L'envoi a échoué, réessaie.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Pointeur grossier (téléphone, tablette) : ouvre directement l'appareil photo arrière. */}
      <label
        className={cn(
          buttonVariants({ size: "lg" }),
          "hidden h-11 cursor-pointer focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 pointer-coarse:inline-flex",
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
      <Field>
        <FieldLabel htmlFor="photo">Photo de la carte</FieldLabel>
        <Input id="photo" type="file" accept="image/*" onChange={pickFrom} />
        <FieldDescription>Photo de l'écran de fin de round, prise au téléphone.</FieldDescription>
      </Field>
      {message ? (
        <Alert>
          <AlertTitle>{message}</AlertTitle>
        </Alert>
      ) : null}
      {step.kind === "unreadable" ? <UnreadablePhoto /> : null}
      {step.kind === "crop" ? (
        <CropSteps
          key={step.photo.url}
          photoUrl={step.photo.url}
          initialCorners={INITIAL_CORNERS}
          onLaunch={(corners) => launch(step.photo, corners)}
        />
      ) : null}
    </div>
  );
}
