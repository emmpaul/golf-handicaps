import { afterEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "../factories";

let testDb: TestDb;

afterEach(() => {
  testDb.cleanup();
});

describe("migrations", () => {
  it("crée toutes les tables du design sur une base vide", () => {
    testDb = createTestDb();
    const tables = testDb.sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .pluck()
      .all();
    expect(tables).toEqual([
      "__drizzle_migrations",
      "imports",
      "jobs",
      "player_aliases",
      "player_round_stats",
      "players",
      "round_holes",
      "round_players",
      "rounds",
      "scores",
    ]);
  });

  it("stocke les valeurs de handicap en dixièmes entiers", () => {
    testDb = createTestDb();
    const columns = testDb.sqlite
      .prepare("SELECT name, type FROM pragma_table_info('player_round_stats') ORDER BY cid")
      .all();
    expect(columns).toEqual([
      { name: "round_id", type: "INTEGER" },
      { name: "player_id", type: "INTEGER" },
      { name: "gross", type: "INTEGER" },
      { name: "adjusted", type: "INTEGER" },
      { name: "differential_t", type: "INTEGER" },
      { name: "index_before_t", type: "INTEGER" },
      { name: "index_after_t", type: "INTEGER" },
      { name: "counts_in_current", type: "INTEGER" },
    ]);
  });

  it("ouvre la base en WAL, busy_timeout 5000 ms et clés étrangères actives", () => {
    testDb = createTestDb();
    const pragma = (name: string) => testDb.sqlite.pragma(name, { simple: true });
    expect([pragma("journal_mode"), pragma("busy_timeout"), pragma("foreign_keys")]).toEqual([
      "wal",
      5000,
      1,
    ]);
  });

  it.each([
    ["players", "INSERT INTO players (name, created_at) VALUES (?, 0)", ["Gab", "gab"]],
    [
      "player_aliases",
      "INSERT INTO player_aliases (player_id, alias) VALUES (1, ?)",
      ["GAB", "gab"],
    ],
  ])(
    "refuse un doublon sans tenir compte de la casse dans %s",
    (_table, insert, [first, second]) => {
      testDb = createTestDb();
      testDb.sqlite
        .prepare("INSERT INTO players (id, name, created_at) VALUES (1, 'Seed', 0)")
        .run();
      testDb.sqlite.prepare(insert).run(first);
      expect(() => testDb.sqlite.prepare(insert).run(second)).toThrow(/UNIQUE constraint failed/);
    },
  );
});
