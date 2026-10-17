import { describe, expect, it } from "vitest";
import { checkDraft, checkRoundForm, problemCountLabel, type RoundForm } from "@/scorecard/checks";
import type { ScorecardDraft } from "@/scorecard/draft";
import { referenceForm } from "../factories";
import referenceDraft from "../fixtures/scorecards/gspro-img3064.draft.json";

/** Cases d'une ligne pour les trous `from` à `to` (numéros de trou 1 à 18). */
const holeCells = (row: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${row}:${from + i}`);

const checked = (change: (form: RoundForm) => void) => {
  const form = referenceForm();
  change(form);
  return checkRoundForm(form);
};

describe("checkRoundForm — carte cohérente", () => {
  // Mutation : un contrôle qui signale à tort une carte juste (ex. par 3..5 exclusif, somme décalée d'un trou).
  it("ne signale aucun problème sur la carte de référence", () => {
    expect(checkRoundForm(referenceForm())).toEqual([]);
  });

  // Mutation : distance traitée comme obligatoire.
  it("accepte une ligne DISTANCE entièrement vide (facultative)", () => {
    expect(
      checked((form) => {
        form.distance = { holes: Array(18).fill(null), out: null, in: null, total: null };
      }),
    ).toEqual([]);
  });
});

describe("checkRoundForm — sommes", () => {
  // Mutation : mauvais libellé, somme sur les trous 1 à 8 ou 2 à 10, OUT absent des cases surlignées.
  it("signale « Somme aller 36 ≠ OUT 38 » sur la ligne aller de Gab", () => {
    expect(
      checked((form) => {
        form.players[0].scores.holes[8] = 3;
      }),
    ).toEqual([
      { message: "Somme aller 36 ≠ OUT 38", cells: [...holeCells("player0", 1, 9), "player0:out"] },
    ]);
  });

  // Mutation : IN comparé à la somme aller, TOT comparé à la somme des 18 trous au lieu de OUT + IN.
  it("signale la somme retour et le total quand IN de Manu est faux", () => {
    expect(
      checked((form) => {
        form.players[1].scores.in = 41;
      }),
    ).toEqual([
      {
        message: "Somme retour 42 ≠ IN 41",
        cells: [...holeCells("player1", 10, 18), "player1:in"],
      },
      {
        message: "OUT + IN 87 ≠ TOT 88",
        cells: ["player1:out", "player1:in", "player1:total"],
      },
    ]);
  });

  // Mutation : ligne PAR exclue des contrôles de somme.
  it("contrôle aussi les sommes de la ligne PAR", () => {
    expect(
      checked((form) => {
        form.par.total = 72;
      }),
    ).toEqual([{ message: "OUT + IN 71 ≠ TOT 72", cells: ["par:out", "par:in", "par:total"] }]);
  });
});

describe("checkRoundForm — valeurs hors bornes", () => {
  // Mutation : bornes 3..5 ou 1..15 décalées, ou index hors 1..18 non signalé.
  it.each([
    {
      name: "par 2 et par 6",
      change: (form: RoundForm) => {
        form.par.holes[2] = 2;
        form.par.holes[3] = 6;
      },
      expected: [
        { message: "Par 2 hors de 3 à 5", cells: ["par:3"] },
        { message: "Par 6 hors de 3 à 5", cells: ["par:4"] },
      ],
    },
    {
      name: "score 16",
      change: (form: RoundForm) => {
        form.players[0].scores.holes[0] = 16;
        form.players[0].scores.out = 49;
        form.players[0].scores.total = 83;
      },
      expected: [{ message: "Score 16 hors de 1 à 15", cells: ["player0:1"] }],
    },
    {
      name: "score 0",
      change: (form: RoundForm) => {
        form.players[1].scores.holes[17] = 0;
        form.players[1].scores.in = 37;
        form.players[1].scores.total = 83;
      },
      expected: [{ message: "Score 0 hors de 1 à 15", cells: ["player1:18"] }],
    },
    {
      name: "index 19",
      change: (form: RoundForm) => {
        form.strokeIndex[0] = 19;
      },
      expected: [{ message: "Index 19 hors de 1 à 18", cells: ["strokeIndex:1"] }],
    },
  ])("$name : un problème par case", ({ change, expected }) => {
    expect(checked(change)).toEqual(expected);
  });

  // Mutation : une seule des deux cases surlignée, ou un problème « index manquant » en plus.
  it("surligne les deux cases d'index valant 1 quand 11 manque", () => {
    expect(
      checked((form) => {
        form.strokeIndex[10] = 1;
      }),
    ).toEqual([{ message: "Index 1 en double", cells: ["strokeIndex:11", "strokeIndex:15"] }]);
  });
});

describe("checkRoundForm — cases vides et joueurs", () => {
  // Mutation : case vide ignorée, ou somme calculée avec la case vide (problème de somme en plus).
  it("signale chaque case vide, sans contrôle de somme sur sa ligne", () => {
    expect(
      checked((form) => {
        form.courseName = null;
        form.par.out = null;
        form.strokeIndex[4] = null;
        form.players[1].scores.holes[4] = null;
      }),
    ).toEqual([
      { message: "Case vide", cells: ["courseName"] },
      { message: "Case vide", cells: ["par:out"] },
      { message: "Case vide", cells: ["strokeIndex:5"] },
      { message: "Case vide", cells: ["player1:5"] },
    ]);
  });

  // Mutation : ligne sans joueur acceptée.
  it("signale une ligne associée à personne", () => {
    expect(checkRoundForm(referenceForm([1, null]))).toEqual([
      { message: "Ligne sans joueur", cells: ["player1:player"] },
    ]);
  });

  // Mutation : doublon non détecté, ou signalé une fois par ligne.
  it("signale deux lignes associées au même joueur", () => {
    expect(checkRoundForm(referenceForm([2, 2]))).toEqual([
      { message: "Joueur en double", cells: ["player0:player", "player1:player"] },
    ]);
  });

  // Mutation : round sans joueur accepté.
  it("signale un round sans aucune ligne de joueur", () => {
    expect(
      checked((form) => {
        form.players = [];
      }),
    ).toEqual([{ message: "Aucune ligne de joueur", cells: [] }]);
  });

  // Mutation : plus de 4 lignes acceptées.
  it("signale plus de 4 lignes de joueur", () => {
    expect(
      checked((form) => {
        const [gab] = form.players;
        form.players = [3, 4, 5, 6, 7].map((playerId) => ({ ...gab, playerId }));
      }),
    ).toEqual([{ message: "4 joueurs au plus", cells: [] }]);
  });
});

describe("checkRoundForm — nombre de problèmes", () => {
  // Mutation : problèmes dédoublonnés ou fusionnés, ou arrêt au premier problème.
  it("liste exactement 5 problèmes, dans l'ordre de la carte, pour 4 défauts", () => {
    const form = referenceForm([1, null]);
    form.tees = null;
    form.par.holes[0] = 7;
    form.strokeIndex[1] = null;
    expect(checkRoundForm(form).map((problem) => problem.message)).toEqual([
      "Case vide",
      "Par 7 hors de 3 à 5",
      "Somme aller 39 ≠ OUT 36",
      "Case vide",
      "Ligne sans joueur",
    ]);
  });
});

/** Brouillon de la carte de référence (GAB = `player0`, MANU = `player1`) après `change`. */
const checkedDraft = (change: (draft: ScorecardDraft) => void) => {
  const draft: ScorecardDraft = structuredClone(referenceDraft);
  change(draft);
  return checkDraft(draft);
};

describe("checkDraft — brouillon de la lecture, sans association de joueurs", () => {
  // Mutation : un contrôle qui signale à tort le brouillon de référence, ou « Ligne sans joueur » sur un brouillon.
  it("ne signale aucun problème sur le brouillon de référence", () => {
    expect(checkDraft(structuredClone(referenceDraft))).toEqual([]);
  });

  // Mutation : case vide ignorée, ou somme aller calculée avec la case vide.
  it("signale seulement la case vide quand le score de Gab au trou 9 manque", () => {
    expect(
      checkedDraft((draft) => {
        draft.players[0].scores.holes[8] = null;
      }),
    ).toEqual([{ message: "Case vide", cells: ["player0:9"] }]);
  });

  // Mutation : contrôles de somme absents des lignes de joueur du brouillon.
  it("signale « Somme aller 36 ≠ OUT 38 » quand Gab a 3 au trou 9", () => {
    const [problem, ...others] = checkedDraft((draft) => {
      draft.players[0].scores.holes[8] = 3;
    });
    expect(others).toEqual([]);
    expect(problem.message).toBe("Somme aller 36 ≠ OUT 38");
    expect(problem.cells).toEqual([
      "player0:1",
      "player0:2",
      "player0:3",
      "player0:4",
      "player0:5",
      "player0:6",
      "player0:7",
      "player0:8",
      "player0:9",
      "player0:out",
    ]);
  });

  // Mutation : date traitée comme obligatoire dans le brouillon.
  it("accepte un brouillon sans date", () => {
    expect(
      checkedDraft((draft) => {
        draft.playedOn = null;
      }),
    ).toEqual([]);
  });

  // Mutation : distance traitée comme obligatoire dans le brouillon.
  it("accepte un brouillon sans distance", () => {
    expect(
      checkedDraft((draft) => {
        draft.distance = { holes: Array(18).fill(null), out: null, in: null, total: null };
      }),
    ).toEqual([]);
  });
});

describe("checkRoundForm — date", () => {
  // Mutation : la date manquante n'est plus signalée une fois les contrôles du brouillon réutilisés.
  it("signale la date vide du formulaire", () => {
    expect(
      checked((form) => {
        form.playedOn = null;
      }),
    ).toEqual([{ message: "Case vide", cells: ["playedOn"] }]);
  });
});

describe("problemCountLabel", () => {
  // Mutation : pluriel absent, ou libellé différent de celui du bouton d'enregistrement.
  it.each([
    [1, "1 problème à corriger"],
    [2, "2 problèmes à corriger"],
  ])("%i donne « %s »", (count, label) => {
    expect(problemCountLabel(count)).toBe(label);
  });
});
