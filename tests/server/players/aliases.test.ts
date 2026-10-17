import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findPlayerForName, learnAlias } from "@/server/players/aliases";
import { listPlayers } from "@/server/players/players";
import { seedInitialPlayers } from "@/server/players/seed";
import { createTestDb, type TestDb } from "../../factories";

let testDb: TestDb;
let ids: Record<string, number>;

beforeEach(() => {
  testDb = createTestDb();
  seedInitialPlayers(testDb.db);
  ids = Object.fromEntries(listPlayers(testDb.db).map((p) => [p.name, p.id]));
});

afterEach(() => {
  testDb.cleanup();
});

const find = (read: string) => findPlayerForName(testDb.db, read);

describe("findPlayerForName", () => {
  it("associe « GAB » à Gab", () => {
    expect(find("GAB")).toEqual({ playerId: ids.Gab, match: "exact" });
  });

  it("pré-associe « MANV » à Manu", () => {
    expect(find("MANV")).toEqual({ playerId: ids.Manu, match: "close" });
  });

  it("n'associe « JULIEN » à personne", () => {
    expect(find("JULIEN")).toBeNull();
  });
});

describe("learnAlias", () => {
  it("associe directement « SEANP » à Sean après association manuelle", () => {
    learnAlias(testDb.db, ids.Sean, "SEANP");
    expect(find("SEANP")).toEqual({ playerId: ids.Sean, match: "exact" });
  });

  it("déplace vers le joueur choisi un alias déjà appris pour un autre", () => {
    learnAlias(testDb.db, ids.Gab, "SEANP");
    learnAlias(testDb.db, ids.Sean, " seanp ");
    expect(find("SEANP")).toEqual({ playerId: ids.Sean, match: "exact" });
  });
});
