"use client";

// Seul fichier qui importe thinking-orbs : changer d'indicateur ne touche que lui (décision 2).
import { type OrbState, ThinkingOrb } from "thinking-orbs";
import type { ImportStatus } from "@/jobs/imports";

/** Animation de l'orbe selon le type d'attente (décision 3). */
export const ORB_FOR = {
  prepare: "working",
  send: "working",
  save: "working",
  rectify: "shaping",
  queued: "breathing",
  reading: "searching",
} as const satisfies Record<string, OrbState>;

export type PendingKind = keyof typeof ORB_FOR;

/** Animation d'un import qui attend sa lecture, `null` une fois la lecture finie. */
export function orbForImport(status: ImportStatus): OrbState | null {
  return status === "queued" || status === "reading" ? ORB_FOR[status] : null;
}

/**
 * Orbe seule, décorative : `aria-hidden` écarte son libellé anglais par défaut.
 * `theme="light"` fixé : l'app est toujours claire, `auto` suivrait le mode sombre du téléphone.
 */
export function PendingOrb({ state }: { state: OrbState }) {
  return <ThinkingOrb state={state} size={20} theme="light" aria-hidden role="presentation" />;
}

/**
 * Région `role="status"` toujours montée : orbe et texte court pendant l'attente (`label`),
 * vide au repos (`null`). Un lecteur d'écran n'annonce pas toujours une région insérée déjà
 * remplie (VoiceOver) : on la monte avant l'attente et on n'en change que le contenu.
 * Vide, elle est `sr-only` : hors du flux, elle n'ajoute ni espace ni décalage.
 */
export function Pending({ label, orb }: { label: string | null; orb: PendingKind }) {
  return (
    <span
      role="status"
      className={
        label === null ? "sr-only" : "inline-flex items-center gap-2 text-sm text-muted-foreground"
      }
    >
      {label === null ? null : (
        <>
          <PendingOrb state={ORB_FOR[orb]} />
          <span>{label}</span>
        </>
      )}
    </span>
  );
}
