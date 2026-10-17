import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addPlayer,
  DuplicatePlayerError,
  listPlayers,
  renamePlayer,
} from "@/server/players/players";
import { seedInitialPlayers } from "@/server/players/seed";
import { createTestDb, type TestDb } from "../../factories";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
  seedInitialPlayers(testDb.db);
});

afterEach(() => {
  testDb.cleanup();
});

const names = () => listPlayers(testDb.db).map((p) => p.name);
const idOf = (name: string) => {
  const player = listPlayers(testDb.db).find((p) => p.name === name);
  if (!player) throw new Error(`joueur ${name} absent`);
  return player.id;
};

describe("addPlayer", () => {
  it("ajoute « Alex » à la liste des joueurs", () => {
    addPlayer(testDb.db, "Alex");
    expect(names()).toEqual(["Alex", "Gab", "Manu", "Sean"]);
  });
});

describe("renamePlayer", () => {
  it("renomme Gab en « Gabriel »", () => {
    renamePlayer(testDb.db, idOf("Gab"), "Gabriel");
    expect(names()).toEqual(["Gabriel", "Manu", "Sean"]);
  });

  it("accepte de changer seulement la casse du nom du joueur lui-même", () => {
    renamePlayer(testDb.db, idOf("Gab"), "GAB");
    expect(names()).toEqual(["GAB", "Manu", "Sean"]);
  });
});

describe("nom en double", () => {
  it.each([
    ["l'ajout de « gab »", () => addPlayer(testDb.db, "gab")],
    ["le renommage de Manu en « GAB »", () => renamePlayer(testDb.db, idOf("Manu"), "GAB")],
  ])("refuse %s avec « Ce joueur existe déjà »", (_case, write) => {
    expect(write).toThrow(DuplicatePlayerError);
    expect(write).toThrow(/^Ce joueur existe déjà$/);
    expect(names()).toEqual(["Gab", "Manu", "Sean"]);
  });
});
