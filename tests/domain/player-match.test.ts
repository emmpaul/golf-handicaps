import { describe, expect, it } from "vitest";
import { matchPlayerName, type PlayerCandidate } from "@/domain/player-match";

const group: PlayerCandidate[] = [
  { id: 1, name: "Manu", aliases: ["MANU"] },
  { id: 2, name: "Gab", aliases: ["GAB"] },
  { id: 3, name: "Sean", aliases: ["SEAN", "SEANP"] },
];

describe("matchPlayerName", () => {
  it.each([
    ["GAB", 2],
    ["  gab ", 2],
    ["manu", 1],
    ["Seanp", 3],
  ])("associe « %s » exactement au joueur %i", (read, playerId) => {
    expect(matchPlayerName(read, group)).toEqual({ playerId, match: "exact" });
  });

  it.each([
    ["MANV", 1],
    ["GA", 2],
    [" seanpp", 3],
  ])("pré-associe « %s » au joueur %i à 1 caractère près", (read, playerId) => {
    expect(matchPlayerName(read, group)).toEqual({ playerId, match: "close" });
  });

  it.each(["JULIEN", "MA", "", "   "])("n'associe « %s » à personne", (read) => {
    expect(matchPlayerName(read, group)).toBeNull();
  });

  it("laisse le choix quand deux joueurs sont à 1 caractère", () => {
    const bob = { id: 4, name: "Bob", aliases: [] };
    expect(matchPlayerName("GOB", [...group, bob])).toBeNull();
  });
});
