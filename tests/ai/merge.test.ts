import { describe, expect, it } from "vitest";
import type { AiCard } from "@/ai/card";
import { mergeDraft } from "@/ai/merge";
import { checkDraft } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import referenceDraft from "../fixtures/scorecards/gspro-img3064.draft.json";

/** Brouillon local : la lecture de référence, modifiée par `change`. */
const localDraft = (change?: (draft: ScorecardDraft) => void) => {
  const draft: ScorecardDraft = structuredClone(referenceDraft);
  change?.(draft);
  return draft;
};

/** Carte lue par l'IA : celle de référence (sans date), modifiée par `change`. */
const aiCard = (change?: (card: AiCard) => void) => {
  const { playedOn: _, ...card }: ScorecardDraft = structuredClone(referenceDraft);
  change?.(card);
  return card;
};

const merged = (local: ScorecardDraft, ai: AiCard) => mergeDraft(local, ai, checkDraft(local));

/** Gab note 3 au trou 9 au lieu de 5 : « Somme aller 36 ≠ OUT 38 », toute sa ligne aller en problème. */
const gabHole9Is3 = () =>
  localDraft((draft) => {
    draft.players[0].scores.holes[8] = 3;
  });

describe("mergeDraft — cases en problème seulement (spec « Fusion avec la lecture locale »)", () => {
  // Mutation : case vide laissée à null, ou clé de case non ajoutée à `aiCells` (ou au format `player0:8`).
  it("complète le score vide de Gab au trou 9 avec le 5 lu par l'IA", () => {
    const local = localDraft((draft) => {
      draft.players[0].scores.holes[8] = null;
    });

    const { draft, aiCells } = merged(local, aiCard());

    expect(draft.players[0].scores.holes[8]).toBe(5);
    expect(aiCells).toEqual(["player0:9"]);
  });

  // Mutation : toutes les cases prises à l'IA, sans filtrer sur les cases en problème.
  it("garde le 7 de Manu au trou 1 quand sa ligne n'a aucun problème et que l'IA lit 1", () => {
    const local = localDraft((draft) => {
      draft.players[0].scores.holes[8] = null;
    });
    const ai = aiCard((card) => {
      card.players[0].scores.holes[8] = null;
      card.players[1].scores.holes[0] = 1;
    });

    const { draft, aiCells } = merged(local, ai);

    expect(draft.players[1].scores.holes[0]).toBe(7);
    expect(aiCells).toEqual([]);
  });

  // Mutation : un `null` de l'IA écrase la valeur locale, ou une case est marquée quand l'IA
  // la rend null ou identique (trous 1 à 8 et OUT 38 lus pareil par l'IA).
  it("garde la valeur locale d'une case en problème que l'IA rend null, sans la marquer", () => {
    const local = gabHole9Is3();
    const ai = aiCard((card) => {
      card.players[0].scores.holes[8] = null;
    });

    const { draft, aiCells } = merged(local, ai);

    expect(draft.players[0].scores.holes[8]).toBe(3);
    expect(aiCells).toEqual([]);
  });

  // Mutation : case marquée dès qu'elle est éligible et que l'IA la lit, même à valeur égale.
  it("sur « Somme aller 36 ≠ OUT 38 », ne marque que l'OUT que l'IA lit 36", () => {
    const local = gabHole9Is3();
    const ai = aiCard((card) => {
      card.players[0].scores.holes[8] = 3;
      card.players[0].scores.out = 36;
    });

    const { draft, aiCells } = merged(local, ai);

    expect(draft.players[0].scores.holes.slice(0, 9)).toEqual([5, 5, 3, 5, 4, 4, 4, 3, 3]);
    expect(draft.players[0].scores.out).toBe(36);
    expect(aiCells).toEqual(["player0:out"]);
  });

  // Mutation : lignes de l'IA en trop ignorées, ajoutées sans marque, ou marquées sans les totaux.
  it("ajoute la 3e ligne vue par l'IA seule et marque toutes ses cases", () => {
    const luc = {
      name: "LUC",
      scores: {
        holes: [4, 5, 3, 6, 4, 5, 5, 4, 4, 5, 4, 4, 6, 3, 5, 4, 3, 4],
        out: 40,
        in: 38,
        total: 78,
      },
    };
    const ai = aiCard((card) => {
      card.players.push(luc);
    });

    const { draft, aiCells } = merged(localDraft(), ai);

    expect(draft.players.map(({ name }) => name)).toEqual(["GAB", "MANU", "LUC"]);
    expect(draft.players[2]).toEqual(luc);
    expect(aiCells).toEqual([
      "player2:1",
      "player2:2",
      "player2:3",
      "player2:4",
      "player2:5",
      "player2:6",
      "player2:7",
      "player2:8",
      "player2:9",
      "player2:10",
      "player2:11",
      "player2:12",
      "player2:13",
      "player2:14",
      "player2:15",
      "player2:16",
      "player2:17",
      "player2:18",
      "player2:out",
      "player2:in",
      "player2:total",
    ]);
  });

  // Mutation : champs texte ignorés par la fusion (seules les lignes de trous fusionnées).
  it("reprend le parcours et les tees de l'IA quand la lecture locale les laisse vides", () => {
    const local = localDraft((draft) => {
      draft.courseName = null;
      draft.tees = "";
    });

    const { draft, aiCells } = merged(local, aiCard());

    expect([draft.courseName, draft.tees]).toEqual(["BETHPAGE BLACK", "Red"]);
    expect(aiCells).toEqual(["courseName", "tees"]);
  });
});
