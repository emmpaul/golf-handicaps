import { describe, expect, it, vi } from "vitest";
import { referenceForm } from "../../factories";

type FormState = typeof import("@/components/round-editor/form-state");

/** Copie neuve du module, comme un serveur qui vient de démarrer ou un onglet qui vient de charger. */
async function freshFormState(): Promise<FormState> {
  vi.resetModules();
  return import("@/components/round-editor/form-state");
}

const SEAN = 3;

describe("clés des lignes de l'éditeur : serveur et navigateur", () => {
  // Mutation : `newLine` donne une clé tirée d'un compteur propre à chaque copie du module (ou
  // une clé constante) : la ligne ajoutée reprend la clé de la ligne 1, et Sean y est associé aussi.
  it("une ligne ajoutée dans le navigateur reçoit Sean sans changer le joueur de la ligne 1", async () => {
    // Écran pré-rempli par le serveur : GAB (joueur 1) et MANU (joueur 2).
    const server = await freshFormState();
    const initial = server.readEditorState(referenceForm([1, 2]), true);

    // « Ajouter une ligne » dans le navigateur, avec sa propre copie du module.
    const browser = await freshFormState();
    const added = browser.newLine();
    const state = browser.associatePlayer(
      { ...initial, lines: [...initial.lines, added] },
      added.key,
      SEAN,
    );

    expect(state.lines.map(({ playerId }) => playerId)).toEqual([1, 2, 3]);
    expect(new Set(state.lines.map(({ key }) => key)).size).toBe(3);
  });
});
