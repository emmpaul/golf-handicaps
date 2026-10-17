import { describe, expect, it } from "vitest";
import {
  type EditorState,
  readEditorState,
  restoreEditorState,
  toSavedCorrection,
} from "@/components/round-editor/form-state";
import { referenceForm } from "../../factories";

const PLAYERS = [
  { id: 1, name: "Gab" },
  { id: 2, name: "Manu" },
];

/** Écran pré-rempli par la carte de référence (GAB puis MANU), lignes non associées. */
const referenceState = (aiCells: string[] = []): EditorState =>
  readEditorState(referenceForm([null, null]), true, aiCells);

const roundTrip = (state: EditorState) =>
  restoreEditorState(structuredClone(toSavedCorrection(state)), PLAYERS);

describe("correction enregistrée : aller-retour de l'état de l'éditeur", () => {
  // Mutation : `playerId` non enregistré, date ou cases prises ailleurs que dans l'état, aiCells perdues.
  it("retrouve le joueur choisi, la case corrigée, la date et les marques IA", () => {
    const state = referenceState(["player0:9"]);
    state.lines[0].playerId = 1;
    state.lines[1].scores.holes[0] = 6;
    state.form.playedOn = "2026-10-13";

    const restored = roundTrip(state);

    expect(restored.lines.map(({ playerId }) => playerId)).toEqual([1, null]);
    expect(restored.lines[1].scores.holes[0]).toBe(6);
    expect(restored.form.playedOn).toBe("2026-10-13");
    expect(restored.aiCells).toEqual(["player0:9"]);
  });

  // Mutation : totaux recalculés à la reprise, ou `readTotals` / `readCardTotals` remis à `false`.
  it("garde les totaux lus : un OUT lu de 38 reste 38 quand les trous font 36", () => {
    const state = referenceState();
    state.lines[0].scores.holes[8] = 3;

    const restored = roundTrip(state);

    expect(restored.readCardTotals).toBe(true);
    expect(restored.lines.map(({ readTotals }) => readTotals)).toEqual([true, true]);
    expect(restored.lines[0].scores.out).toBe(38);
  });

  // Mutation : `key` recopiée dans la correction, ou reprise telle quelle.
  it("n'enregistre pas les `key` des lignes et en donne de nouvelles, distinctes, à la reprise", () => {
    const saved = toSavedCorrection(referenceState());
    expect(saved.lines[0]).not.toHaveProperty("key");

    const [first, second] = restoreEditorState(saved, PLAYERS).lines;
    expect(first.key).not.toBe(second.key);
  });

  // Mutation : `playerId` repris sans vérifier la liste des joueurs.
  it("remet à `null` un joueur 999 absent de la liste des joueurs", () => {
    const state = referenceState();
    state.lines[0].playerId = 999;
    state.lines[1].playerId = 2;

    expect(roundTrip(state).lines.map(({ playerId }) => playerId)).toEqual([null, 2]);
  });
});
