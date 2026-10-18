import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { playerAliases } from "@/db/schema";
import { findPlayerForName, learnAlias, removeAlias } from "@/server/players/aliases";
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

describe("removeAlias", () => {
  const allAliases = () =>
    testDb.db
      .select({ alias: playerAliases.alias })
      .from(playerAliases)
      .orderBy(playerAliases.alias)
      .all()
      .map((row) => row.alias);

  it("retire « seanp » de Manu : « SEANP » ne renvoie plus Manu, seulement Sean en proche", () => {
    learnAlias(testDb.db, ids.Manu, "SEANP");
    removeAlias(testDb.db, ids.Manu, "seanp");
    expect(find("SEANP")).toEqual({ playerId: ids.Sean, match: "close" });
  });

  it("ne retire pas l'alias porté par un autre joueur", () => {
    learnAlias(testDb.db, ids.Manu, "SEANP");
    removeAlias(testDb.db, ids.Sean, "SEANP");
    expect(find("SEANP")).toEqual({ playerId: ids.Manu, match: "exact" });
  });

  it("ne fait rien pour un alias absent", () => {
    learnAlias(testDb.db, ids.Manu, "SEANP");
    removeAlias(testDb.db, ids.Manu, "JULIEN");
    expect(allAliases()).toEqual(["GAB", "MANU", "SEAN", "SEANP"]);
  });
});
