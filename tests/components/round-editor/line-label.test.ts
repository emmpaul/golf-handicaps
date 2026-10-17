import { describe, expect, it } from "vitest";
import { lineLabel, newLine } from "@/components/round-editor/form-state";

const PLAYERS = [
  { id: 1, name: "Gab" },
  { id: 2, name: "Manu" },
];

describe("lineLabel", () => {
  it("affiche le nom du joueur associé, pas le nom lu", () => {
    expect(lineLabel(newLine({ name: "MANV", playerId: 2 }), 1, PLAYERS)).toBe("Manu");
  });

  it("affiche le nom lu suivi de « ? » quand la ligne n'est associée à personne", () => {
    expect(lineLabel(newLine({ name: "JULIEN" }), 1, PLAYERS)).toBe("JULIEN ?");
  });

  it("affiche « Ligne n » sans joueur associé ni nom lu", () => {
    expect(lineLabel(newLine(), 2, PLAYERS)).toBe("Ligne 3");
  });

  it("retombe sur le nom lu quand le joueur associé n'est plus dans la liste", () => {
    expect(lineLabel(newLine({ name: "SEAN", playerId: 9 }), 0, PLAYERS)).toBe("SEAN ?");
  });
});
