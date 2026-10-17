import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { resetDatabase } from "@/db/reset";
import { listRounds } from "@/server/rounds/list";
import { createTestDb, type TestDb } from "../../factories";

let testDb: TestDb;

afterEach(() => {
  testDb.cleanup();
});

describe("pnpm db:reset", () => {
  // Mutation : seeder du round absent de `localSeeders`, ou scores de Gab et Manu inversés.
  it("recrée la base avec le round de référence de Gab et Manu", () => {
    testDb = createTestDb();
    testDb.sqlite.close();
    resetDatabase(testDb.file);
    const reopened = openDatabase(testDb.file);
    testDb.sqlite = reopened.sqlite;
    const summaries = listRounds(reopened.db).map(
      ({ id, playedOn, courseName, tees, players }) =>
        `${id} ${playedOn} ${courseName} / ${tees} : ${players
          .map(({ name, gross }) => `${name} ${gross}`)
          .join(", ")}`,
    );
    expect(summaries).toEqual(["1 2026-10-17 BETHPAGE BLACK / Red : Gab 72, Manu 88"]);
  });
});
