import { describe, expect, it } from "vitest";
import {
  emptyEditorState,
  newLine,
  readEditorState,
  removeLine,
  withoutAiCell,
} from "@/components/round-editor/form-state";
import type { RoundForm } from "@/scorecard/checks";
import referenceDraft from "../../fixtures/scorecards/gspro-img3064.draft.json";

const REFERENCE_FORM: RoundForm = {
  ...referenceDraft,
  players: referenceDraft.players.map((row) => ({ ...row, playerId: null })),
};

describe("cases complétées par l'IA dans l'éditeur", () => {
  it("l'écran pré-rempli reprend les cases complétées par l'IA", () => {
    expect(readEditorState(REFERENCE_FORM, true, ["player0:9", "tees"]).aiCells).toEqual([
      "player0:9",
      "tees",
    ]);
  });

  it("l'écran vide n'a aucune case complétée par l'IA", () => {
    expect(emptyEditorState("2026-10-17").aiCells).toEqual([]);
  });

  it("une case modifiée n'est plus marquée, les autres le restent", () => {
    const state = readEditorState(REFERENCE_FORM, true, ["player0:9", "tees"]);
    expect(withoutAiCell(state, "player0:9").aiCells).toEqual(["tees"]);
  });

  it("modifier une case non marquée garde toutes les marques", () => {
    const state = readEditorState(REFERENCE_FORM, true, ["player0:9", "tees"]);
    expect(withoutAiCell(state, "par:3").aiCells).toEqual(["player0:9", "tees"]);
  });

  it("retirer une ligne efface ses marques et renumérote celles des lignes suivantes", () => {
    const state = {
      ...emptyEditorState("2026-10-17"),
      lines: [newLine(), newLine(), newLine()],
      aiCells: ["player0:9", "player1:out", "player2:4", "par:3"],
    };
    const next = removeLine(state, state.lines[1].key);
    expect(next.lines.map(({ key }) => key)).toEqual([state.lines[0].key, state.lines[2].key]);
    expect(next.aiCells).toEqual(["player0:9", "player1:4", "par:3"]);
  });
});
