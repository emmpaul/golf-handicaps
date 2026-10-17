import { describe, expect, it } from "vitest";
import { savedCorrectionSchema } from "@/scorecard/form-schema";
import referenceDraft from "../fixtures/scorecards/gspro-img3064.draft.json";

/** Correction enregistrée tirée du brouillon de référence : lignes GAB puis MANU, sans joueur. */
function referenceCorrection() {
  const { players, ...card } = structuredClone(referenceDraft);
  return {
    version: 1,
    card,
    readCardTotals: true,
    lines: players.map((row) => ({ ...row, playerId: null, readTotals: true })),
    aiCells: ["player0:9"],
  };
}

describe("savedCorrectionSchema", () => {
  // Mutation : un champ du format exigé à tort, ou une borne trop stricte.
  it("accepte la correction tirée du brouillon de référence", () => {
    expect(savedCorrectionSchema.safeParse(referenceCorrection()).success).toBe(true);
  });

  // Mutation : accepter n'importe quelle `version`.
  it("refuse une correction de version 2", () => {
    expect(savedCorrectionSchema.safeParse({ ...referenceCorrection(), version: 2 }).success).toBe(
      false,
    );
  });

  // Mutation : `lines` sans borne, ou bornée au-delà de 4 (MAX_LINES).
  it("refuse 5 lignes de joueur", () => {
    const correction = referenceCorrection();
    const line = correction.lines[0];
    const lines = [line, line, line, line, line];
    expect(savedCorrectionSchema.safeParse({ ...correction, lines }).success).toBe(false);
  });

  // Mutation : date acceptée sans le format ISO `yyyy-mm-dd`.
  it("refuse la date « 13/10/2026 »", () => {
    const correction = referenceCorrection();
    const card = { ...correction.card, playedOn: "13/10/2026" };
    expect(savedCorrectionSchema.safeParse({ ...correction, card }).success).toBe(false);
  });
});
