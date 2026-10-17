"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type EditorState, toSavedCorrection } from "./form-state";

/** Délai après la dernière modification, puis entre deux essais après un échec. */
const DEBOUNCE_MS = 1000;
const RETRY_MS = 5000;

const NOT_SAVED = "Modifications non enregistrées";
/** Envoi en cours : seul état accompagné de l'orbe. */
export const SAVING = "Enregistrement…";

/** Texte de l'indicateur d'enregistrement ; `error` : à afficher en couleur d'erreur. */
export type AutosaveStatus = { message: string; error: boolean };

const IDLE: AutosaveStatus = { message: "", error: false };

type AutosaveOptions = {
  importId: number;
  /** État d'ouverture : tant que l'écran n'en diffère pas, rien ne part. */
  initial: EditorState;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  window: Pick<EventTarget, "addEventListener" | "removeEventListener">;
  document: Pick<EventTarget, "addEventListener" | "removeEventListener"> & {
    visibilityState: DocumentVisibilityState;
  };
  onStatus: (status: AutosaveStatus) => void;
};

const serialize = (state: EditorState) => JSON.stringify(toSavedCorrection(state));

/**
 * Sauvegarde différée de la correction d'un import (design, décision 4) : un `PUT` 1 s après
 * la dernière modification, un seul envoi à la fois, et un envoi immédiat avec `keepalive`
 * quand la page se cache ou se ferme. Une erreur réseau ou une 5xx réessaie 5 s plus tard ;
 * une 409 (message du serveur), une 400, une 404 ou une 401 arrêtent la sauvegarde.
 */
export function createCorrectionAutosave(options: AutosaveOptions) {
  const url = `/api/imports/${options.importId}/correction`;
  let latest = serialize(options.initial);
  let saved = latest;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  // Une modification attend la fin de l'envoi en cours.
  let queued = false;
  // Arrêt définitif (refus du serveur, démontage) ; la pause, elle, se lève avec `resume`.
  let stopped = false;
  let paused = false;

  function schedule(delay: number) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      send(false);
    }, delay);
  }

  function stop(message: string) {
    stopped = true;
    options.onStatus({ message, error: true });
  }

  async function settle(body: string, response: Response | null) {
    inFlight = false;
    if (stopped) return;
    if (response?.ok) {
      saved = body;
      options.onStatus({ message: "Enregistré", error: false });
    } else if (response === null || response.status >= 500) {
      options.onStatus({ message: NOT_SAVED, error: true });
      schedule(RETRY_MS);
      return;
    } else if (response.status === 409) {
      const { error } = await response.json().catch(() => ({}));
      stop(typeof error === "string" ? error : NOT_SAVED);
      return;
    } else {
      stop(NOT_SAVED);
      return;
    }
    if (queued) {
      queued = false;
      send(false);
    }
  }

  function send(keepalive: boolean) {
    if (stopped || paused || latest === saved) return;
    if (inFlight && !keepalive) {
      queued = true;
      return;
    }
    const body = latest;
    inFlight = true;
    options.onStatus({ message: SAVING, error: false });
    options
      .fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
        keepalive,
      })
      .then(
        (response) => settle(body, response),
        () => settle(body, null),
      );
  }

  /** Sortie de page : l'envoi en attente part tout de suite, sans attendre le délai. */
  function flush() {
    if (timer === null && !queued) return;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    queued = false;
    send(true);
  }

  function clearPending() {
    queued = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  const onVisibility = () => {
    if (options.document.visibilityState === "hidden") flush();
  };
  options.window.addEventListener("pagehide", flush);
  options.document.addEventListener("visibilitychange", onVisibility);

  return {
    change(state: EditorState) {
      const next = serialize(state);
      // Comparée par valeur : un rendu sans modification ne relance pas le délai.
      if (stopped || next === latest) return;
      latest = next;
      if (paused) return;
      if (latest === saved && !inFlight) {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        return;
      }
      schedule(DEBOUNCE_MS);
    },
    /** Enregistrement du round en cours : rien ne part, les modifications sont retenues. */
    pause() {
      paused = true;
      clearPending();
    },
    /**
     * Round non enregistré : la sauvegarde reprend, et l'état non envoyé part tout de suite,
     * puisque la saisie est déjà terminée. Sans effet après un arrêt définitif.
     */
    resume() {
      if (!paused) return;
      paused = false;
      send(false);
    },
    /** Démontage (navigation dans l'appli) : envoie l'attente, puis cesse d'écouter la page. */
    dispose() {
      flush();
      stopped = true;
      clearPending();
      options.window.removeEventListener("pagehide", flush);
      options.document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

/**
 * Branche la sauvegarde différée sur l'état de l'éditeur. `importId` à `null` : désactivée
 * (saisie manuelle, correction d'un round). `pause` : à appeler avant d'enregistrer le round ;
 * `resume` : si le round n'a pas été enregistré.
 */
export function useCorrectionAutosave(importId: number | null, state: EditorState) {
  const [status, setStatus] = useState(IDLE);
  const opening = useRef(state);
  const controller = useRef<ReturnType<typeof createCorrectionAutosave> | null>(null);

  useEffect(() => {
    if (importId === null) return;
    const autosave = createCorrectionAutosave({
      importId,
      initial: opening.current,
      fetch: (url, init) => fetch(url, init),
      window,
      document,
      onStatus: setStatus,
    });
    controller.current = autosave;
    return () => {
      autosave.dispose();
      controller.current = null;
    };
  }, [importId]);

  useEffect(() => {
    controller.current?.change(state);
  }, [state]);

  const pause = useCallback(() => controller.current?.pause(), []);
  const resume = useCallback(() => controller.current?.resume(), []);
  return { status, pause, resume };
}
