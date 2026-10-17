import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AutosaveStatus, createCorrectionAutosave } from "@/components/round-editor/autosave";
import { type EditorState, readEditorState } from "@/components/round-editor/form-state";
import { referenceForm } from "../../factories";

/** Écran pré-rempli par la carte de référence (GAB puis MANU), lignes non associées. */
const opening = (): EditorState => readEditorState(referenceForm([null, null]), true);

/** L'écran d'ouverture où Manu (ligne 2) a `score` au trou 1. */
function withManuHole1(score: number): EditorState {
  const state = opening();
  state.lines[1].scores.holes[0] = score;
  return state;
}

type Call = { url: string; init: RequestInit };

/** Faux `fetch` : chaque appel attend la réponse que le test lui donne. */
function fakeFetch() {
  const calls: Call[] = [];
  const replies: ((response: Response) => void)[] = [];
  const failures: ((error: Error) => void)[] = [];
  const fetch = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Promise<Response>((resolve, reject) => {
      replies.push(resolve);
      failures.push(reject);
    });
  };
  return {
    fetch,
    calls,
    reply: async (index: number, response: Response) => {
      replies[index](response);
      await vi.advanceTimersByTimeAsync(0);
    },
    fail: async (index: number) => {
      failures[index](new TypeError("Failed to fetch"));
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

/** Réponse du serveur quand l'import a déjà son round. */
const roundAlreadySaved = () =>
  Response.json({ error: "Cette carte est déjà enregistrée" }, { status: 409 });

const manuHole1 = (call: Call) =>
  JSON.parse(String(call.init.body)).lines[1].scores.holes[0] as number;

function setup() {
  const server = fakeFetch();
  const statuses: string[] = [];
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible" as DocumentVisibilityState,
  });
  const window = new EventTarget();
  const autosave = createCorrectionAutosave({
    importId: 7,
    initial: opening(),
    fetch: server.fetch,
    window,
    document,
    onStatus: (status: AutosaveStatus) => statuses.push(status.message),
  });
  return { server, statuses, document, window, autosave };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sauvegarde différée de la correction d'un import", () => {
  // Mutation : point de départ vide au lieu de l'état d'ouverture.
  it("n'envoie rien et n'affiche rien tant que l'écran d'ouverture n'a pas changé", async () => {
    const { server, statuses, autosave } = setup();

    autosave.change(opening());
    await vi.advanceTimersByTimeAsync(10_000);

    expect(server.calls).toHaveLength(0);
    expect(statuses).toEqual([]);
  });

  // Mutation : envoyer à chaque modification sans délai, ou relancer le délai à partir de la première.
  it("trois modifications à 300 ms d'écart donnent un seul PUT, 1 000 ms après la dernière", async () => {
    const { server, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(300);
    autosave.change(withManuHole1(5));
    await vi.advanceTimersByTimeAsync(300);
    autosave.change(withManuHole1(4));
    await vi.advanceTimersByTimeAsync(999);
    expect(server.calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].url).toBe("/api/imports/7/correction");
    expect(server.calls[0].init.method).toBe("PUT");
    expect(manuHole1(server.calls[0])).toBe(4);
  });

  // Mutation : statut « Enregistré » posé avant la réponse, ou jamais.
  it("une réponse 204 fait passer le statut de « Enregistrement… » à « Enregistré »", async () => {
    const { server, statuses, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(1000);
    expect(statuses).toEqual(["Enregistrement…"]);

    await server.reply(0, new Response(null, { status: 204 }));
    expect(statuses).toEqual(["Enregistrement…", "Enregistré"]);
  });

  // Mutation : pas de nouvel essai après une erreur réseau, ou un délai autre que 5 000 ms.
  it("un fetch qui rejette affiche « Modifications non enregistrées » et renvoie 5 000 ms plus tard", async () => {
    const { server, statuses, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(1000);
    await server.fail(0);
    expect(statuses).toEqual(["Enregistrement…", "Modifications non enregistrées"]);

    await vi.advanceTimersByTimeAsync(4999);
    expect(server.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.calls).toHaveLength(2);
    expect(manuHole1(server.calls[1])).toBe(6);
  });

  // Mutation : une 5xx traitée comme un refus définitif.
  it("une réponse 503 renvoie aussi 5 000 ms plus tard", async () => {
    const { server, statuses, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(1000);
    await server.reply(0, new Response(null, { status: 503 }));
    expect(statuses).toEqual(["Enregistrement…", "Modifications non enregistrées"]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(server.calls).toHaveLength(2);
  });

  // Mutation : la 409 relancée comme une erreur réseau, ou son message remplacé.
  it("une 409 affiche le message du serveur et arrête la sauvegarde", async () => {
    const { server, statuses, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(1000);
    await server.reply(0, roundAlreadySaved());
    expect(statuses).toEqual(["Enregistrement…", "Cette carte est déjà enregistrée"]);

    autosave.change(withManuHole1(5));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(server.calls).toHaveLength(1);
  });

  // Mutation : 400, 404 ou 401 relancées comme une erreur réseau.
  it.each([400, 404, 401])(
    "une réponse %i affiche « Modifications non enregistrées » et arrête la sauvegarde",
    async (status) => {
      const { server, statuses, autosave } = setup();

      autosave.change(withManuHole1(6));
      await vi.advanceTimersByTimeAsync(1000);
      await server.reply(0, Response.json({ error: "Requête invalide" }, { status }));
      expect(statuses).toEqual(["Enregistrement…", "Modifications non enregistrées"]);

      autosave.change(withManuHole1(5));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(server.calls).toHaveLength(1);
    },
  );

  // Mutation : envoyer pendant un envoi en cours, ou ne pas renvoyer à sa fin.
  it("une modification pendant l'envoi part à sa fin, avec le dernier état seulement", async () => {
    const { server, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(1000);
    autosave.change(withManuHole1(5));
    await vi.advanceTimersByTimeAsync(1000);
    autosave.change(withManuHole1(4));
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.calls).toHaveLength(1);

    await server.reply(0, new Response(null, { status: 204 }));
    expect(server.calls).toHaveLength(2);
    expect(manuHole1(server.calls[1])).toBe(4);
  });

  // Mutation : omettre `keepalive`, ou attendre la fin du délai quand la page se cache.
  it("visibilitychange vers hidden avec un envoi en attente : PUT immédiat avec keepalive", async () => {
    const { server, document, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(300);
    document.visibilityState = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].init.keepalive).toBe(true);
    expect(manuHole1(server.calls[0])).toBe(6);
  });

  // Mutation : envoyer quand la page redevient visible.
  it("visibilitychange vers visible n'envoie rien", async () => {
    const { server, document, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(300);
    document.dispatchEvent(new Event("visibilitychange"));

    expect(server.calls).toHaveLength(0);
  });

  // Mutation : ne pas écouter `pagehide`.
  it("pagehide avec un envoi en attente : PUT immédiat avec keepalive", async () => {
    const { server, window, autosave } = setup();

    autosave.change(withManuHole1(6));
    window.dispatchEvent(new Event("pagehide"));

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].init.keepalive).toBe(true);
  });

  // Mutation : envoyer à la sortie de page sans rien en attente.
  it("pagehide sans modification en attente n'envoie rien", async () => {
    const { server, window } = setup();

    window.dispatchEvent(new Event("pagehide"));

    expect(server.calls).toHaveLength(0);
  });

  // Mutation : `pause` qui ne vide pas le délai en cours.
  it("pause annule l'envoi en attente et les suivants", async () => {
    const { server, window, autosave } = setup();

    autosave.change(withManuHole1(6));
    autosave.pause();
    await vi.advanceTimersByTimeAsync(10_000);
    autosave.change(withManuHole1(5));
    window.dispatchEvent(new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(server.calls).toHaveLength(0);
  });

  // Mutation : `resume` sans effet.
  it("resume après une pause envoie tout de suite le dernier état, en un seul PUT", async () => {
    const { server, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(300);
    autosave.pause();
    autosave.change(withManuHole1(5));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(server.calls).toHaveLength(0);

    autosave.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1);
    expect(manuHole1(server.calls[0])).toBe(5);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(server.calls).toHaveLength(1);
  });

  // Mutation : `resume` qui lève aussi l'arrêt posé par le serveur.
  it("resume après une 409 n'envoie rien, même après une nouvelle modification", async () => {
    const { server, autosave } = setup();

    autosave.change(withManuHole1(6));
    await vi.advanceTimersByTimeAsync(1000);
    await server.reply(0, roundAlreadySaved());
    autosave.pause();
    autosave.resume();
    autosave.change(withManuHole1(5));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(server.calls).toHaveLength(1);
  });
});
