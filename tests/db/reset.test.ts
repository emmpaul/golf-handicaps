import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { resetDatabase } from "@/db/reset";
import { listPlayers } from "@/server/players/players";
import { createTestDb, type TestDb } from "../factories";

let testDb: TestDb;

afterEach(() => {
  testDb.cleanup();
});

describe("resetDatabase", () => {
  it("recrée la base locale avec seulement les 3 joueurs initiaux", () => {
    testDb = createTestDb();
    const file = testDb.sqlite.name;
    testDb.sqlite.prepare("INSERT INTO players (name, created_at) VALUES ('Alex', 0)").run();
    testDb.sqlite.close();

    resetDatabase(file);

    const reopened = openDatabase(file);
    testDb.sqlite = reopened.sqlite;
    expect(listPlayers(reopened.db).map((p) => p.name)).toEqual(["Gab", "Manu", "Sean"]);
  });
});
