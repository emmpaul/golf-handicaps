import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listPlayers } from "@/server/players/players";
import { DEV_PLAYERS, seedInitialPlayers } from "@/server/players/seed";
import { createTestDb, type TestDb } from "../../factories";

let testDb: TestDb;

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.cleanup();
});

const aliasesByPlayer = () =>
  testDb.sqlite
    .prepare(
      "SELECT p.name, a.alias FROM player_aliases a JOIN players p ON p.id = a.player_id ORDER BY a.alias",
    )
    .all();

describe("seedInitialPlayers", () => {
  // Mutation : ignorer `names` et garder la constante Manu, Gab, Sean.
  it("crée exactement les joueurs de la liste sur une base vide", () => {
    seedInitialPlayers(testDb.db, ["Alex", "Sam"]);
    expect(listPlayers(testDb.db).map((p) => p.name)).toEqual(["Alex", "Sam"]);
  });

  it("donne à chacun son nom en majuscules comme alias", () => {
    seedInitialPlayers(testDb.db, ["Alex", "Sam"]);
    expect(aliasesByPlayer()).toEqual([
      { name: "Alex", alias: "ALEX" },
      { name: "Sam", alias: "SAM" },
    ]);
  });

  it("ne crée aucun joueur avec une liste vide", () => {
    seedInitialPlayers(testDb.db, []);
    expect(listPlayers(testDb.db)).toEqual([]);
  });

  it("ne crée ni ne modifie aucun joueur sur une base qui en contient déjà", () => {
    testDb.sqlite.prepare("INSERT INTO players (name, created_at) VALUES ('Gab', 0)").run();
    seedInitialPlayers(testDb.db, ["Alex"]);
    expect(listPlayers(testDb.db).map((p) => p.name)).toEqual(["Gab"]);
    expect(aliasesByPlayer()).toEqual([]);
  });
});

describe("DEV_PLAYERS", () => {
  it("liste Manu, Gab et Sean pour le développement, les tests et les e2e", () => {
    expect(DEV_PLAYERS).toEqual(["Manu", "Gab", "Sean"]);
  });
});
