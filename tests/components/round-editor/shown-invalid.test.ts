import { describe, expect, it } from "vitest";
import {
  emptyEditorState,
  shownInvalidCells,
  toRoundForm,
} from "@/components/round-editor/form-state";
import { checkRoundForm } from "@/scorecard/checks";

// Spec `scorecard-import` « Saisie manuelle neuve sans alerte » : une case vide n'est marquée en
// erreur qu'une fois quittée, sauf dans un import lu par OCR ; un contrôle en défaut l'est toujours.
// Mutation : ignorer l'état « touché » (toute case vide marquée) → les trois premiers tests rougissent.

const emptyProblems = () => checkRoundForm(toRoundForm(emptyEditorState("2026-10-17")));

describe("cases marquées en erreur dans l'éditeur", () => {
  it("saisie manuelle neuve : aucune case marquée", () => {
    const shown = shownInvalidCells(emptyProblems(), {
      touched: new Set(),
      flagUntouchedEmpty: false,
    });
    expect([...shown]).toEqual([]);
  });

  it("saisie manuelle : seule la case quittée vide est marquée", () => {
    const shown = shownInvalidCells(emptyProblems(), {
      touched: new Set(["par:1"]),
      flagUntouchedEmpty: false,
    });
    expect([...shown]).toEqual(["par:1"]);
  });

  it("saisie manuelle : un par hors bornes est marqué sans avoir été quitté", () => {
    const state = emptyEditorState("2026-10-17");
    const holes = [...state.form.par.holes];
    holes[0] = 7;
    const problems = checkRoundForm(
      toRoundForm({ ...state, form: { ...state.form, par: { ...state.form.par, holes } } }),
    );
    const shown = shownInvalidCells(problems, { touched: new Set(), flagUntouchedEmpty: false });
    expect([...shown]).toEqual(["par:1"]);
  });

  it("import lu par OCR : chaque case vide est marquée dès l'ouverture", () => {
    const shown = shownInvalidCells(emptyProblems(), {
      touched: new Set(),
      flagUntouchedEmpty: true,
    });
    // Parcours, tees, 18 pars, 18 index, 18 scores de la ligne 1 et son joueur.
    expect(shown.size).toBe(57);
    expect(shown.has("player0:9")).toBe(true);
    expect(shown.has("player0:player")).toBe(true);
  });
});
