import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listPlayers } from "@/server/players/players";
import { seedInitialPlayers } from "@/server/players/seed";
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
  it("crée exactement Gab, Manu et Sean sur une base vide", () => {
    seedInitialPlayers(testDb.db);
    expect(listPlayers(testDb.db).map((p) => p.name)).toEqual(["Gab", "Manu", "Sean"]);
  });

  it("donne à chacun son nom en majuscules comme alias", () => {
    seedInitialPlayers(testDb.db);
    expect(aliasesByPlayer()).toEqual([
      { name: "Gab", alias: "GAB" },
      { name: "Manu", alias: "MANU" },
      { name: "Sean", alias: "SEAN" },
    ]);
  });

  it("ne crée ni ne modifie aucun joueur sur une base qui en contient déjà", () => {
    testDb.sqlite.prepare("INSERT INTO players (name, created_at) VALUES ('Alex', 0)").run();
    seedInitialPlayers(testDb.db);
    expect(listPlayers(testDb.db).map((p) => p.name)).toEqual(["Alex"]);
    expect(aliasesByPlayer()).toEqual([]);
  });
});
