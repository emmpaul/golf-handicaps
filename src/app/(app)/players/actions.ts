"use server";

import { revalidatePath } from "next/cache";
import type { PlayerOption } from "@/components/round-editor/form-state";
import { getDb } from "@/db/instance";
import { learnAlias, removeAlias } from "@/server/players/aliases";
import { addPlayer, DuplicatePlayerError, renamePlayer } from "@/server/players/players";

export type PlayerFormState = { error: string | null; done: number };

const NAME_REQUIRED = "Le nom est obligatoire";

function text(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "").trim();
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Exécute une écriture et traduit le refus « Ce joueur existe déjà » en message. */
function tryWrite<T>(write: () => T): Outcome<T> {
  let value: T;
  try {
    value = write();
  } catch (error) {
    if (error instanceof DuplicatePlayerError) return { ok: false, error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true, value };
}

function attempt(previous: PlayerFormState, write: () => void): PlayerFormState {
  const outcome = tryWrite(write);
  return outcome.ok
    ? { error: null, done: previous.done + 1 }
    : { ...previous, error: outcome.error };
}

export type CreatedPlayer = { player: PlayerOption; error: null } | { player: null; error: string };

/** Création d'un joueur depuis l'écran de correction (spec `players`, « Nom inconnu »). */
export async function createPlayerAction(rawName: string): Promise<CreatedPlayer> {
  const name = rawName.trim();
  if (!name) return { player: null, error: NAME_REQUIRED };
  const outcome = tryWrite(() => addPlayer(getDb(), name));
  return outcome.ok
    ? { player: outcome.value, error: null }
    : { player: null, error: outcome.error };
}

export async function addPlayerAction(
  previous: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const name = text(formData, "name");
  if (!name) return { ...previous, error: NAME_REQUIRED };
  return attempt(previous, () => addPlayer(getDb(), name));
}

export async function renamePlayerAction(
  previous: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const name = text(formData, "name");
  if (!name) return { ...previous, error: NAME_REQUIRED };
  return attempt(previous, () => renamePlayer(getDb(), Number(formData.get("id")), name));
}

export async function addAliasAction(
  previous: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  const alias = text(formData, "alias");
  if (!alias) return { ...previous, error: "L’alias est obligatoire" };
  return attempt(previous, () => learnAlias(getDb(), Number(formData.get("id")), alias));
}

/** Retrait d'un alias depuis la page Joueurs, sans confirmation (spec `players`). */
export async function removeAliasAction(formData: FormData): Promise<void> {
  removeAlias(getDb(), Number(formData.get("id")), text(formData, "alias"));
  revalidatePath("/", "layout");
}
