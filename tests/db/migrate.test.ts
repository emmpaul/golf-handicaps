import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase, openDatabase } from "@/db/client";
import journal from "../../drizzle/meta/_journal.json";
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
      "ai_usage",
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

  it("ajoute à imports la provenance IA, nulle par défaut", () => {
    testDb = createTestDb();
    const columns = testDb.sqlite
      .prepare(
        "SELECT name, type, \"notnull\", dflt_value AS dflt FROM pragma_table_info('imports') WHERE name LIKE 'ai_%' ORDER BY name",
      )
      .all();
    expect(columns).toEqual([
      { name: "ai_cells", type: "TEXT", notnull: 0, dflt: null },
      { name: "ai_note", type: "TEXT", notnull: 0, dflt: null },
    ]);
  });

  it("ajoute à imports la correction enregistrée, nulle par défaut", () => {
    testDb = createTestDb();
    const columns = testDb.sqlite
      .prepare(
        "SELECT name, type, \"notnull\", dflt_value AS dflt FROM pragma_table_info('imports') WHERE name = 'correction'",
      )
      .all();
    expect(columns).toEqual([{ name: "correction", type: "TEXT", notnull: 0, dflt: null }]);
  });

  it("crée ai_usage avec les colonnes du design (décision 6)", () => {
    testDb = createTestDb();
    const columns = testDb.sqlite
      .prepare("SELECT name, type FROM pragma_table_info('ai_usage') ORDER BY cid")
      .all();
    expect(columns).toEqual([
      { name: "id", type: "INTEGER" },
      { name: "created_at", type: "INTEGER" },
      { name: "month", type: "TEXT" },
      { name: "model", type: "TEXT" },
      { name: "input_tokens", type: "INTEGER" },
      { name: "output_tokens", type: "INTEGER" },
      { name: "cost_micro_usd", type: "INTEGER" },
    ]);
  });
});

describe("migration d'une base existante", () => {
  let dir: string;
  let sqlite: ReturnType<typeof openDatabase>["sqlite"] | undefined;

  afterEach(() => {
    sqlite?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Dossier de migrations arrêté à `lastTag`, l'état d'une base livrée à ce moment-là. */
  function migrationsUntil(lastTag: string): string {
    const folder = join(dir, `drizzle-${lastTag}`);
    cpSync(join(process.cwd(), "drizzle"), folder, { recursive: true });
    const last = journal.entries.findIndex((e) => e.tag === lastTag);
    const kept = { ...journal, entries: journal.entries.slice(0, last + 1) };
    writeFileSync(join(folder, "meta", "_journal.json"), JSON.stringify(kept));
    return folder;
  }

  it("garde les imports d'une base migrée en 0000_init, sans provenance IA", () => {
    dir = mkdtempSync(join(tmpdir(), "golf-migrate-"));
    const opened = openDatabase(join(dir, "app.db"));
    sqlite = opened.sqlite;
    migrateDatabase(opened.db, migrationsUntil("0000_init"));
    sqlite
      .prepare(
        "INSERT INTO imports (id, status, photo_path, corners, draft, created_at) VALUES (7, 'ready', 'imports/7.jpg', '{}', '{\"courseName\":\"BETHPAGE BLACK\"}', 0)",
      )
      .run();

    migrateDatabase(opened.db);

    expect(
      sqlite
        .prepare(
          "SELECT id, status, photo_path AS photoPath, draft, ai_cells AS aiCells, ai_note AS aiNote FROM imports",
        )
        .all(),
    ).toEqual([
      {
        id: 7,
        status: "ready",
        photoPath: "imports/7.jpg",
        draft: '{"courseName":"BETHPAGE BLACK"}',
        aiCells: null,
        aiNote: null,
      },
    ]);
  });

  it("garde les imports d'une base migrée en 0001_ai_completion, sans correction", () => {
    dir = mkdtempSync(join(tmpdir(), "golf-migrate-"));
    const opened = openDatabase(join(dir, "app.db"));
    sqlite = opened.sqlite;
    migrateDatabase(opened.db, migrationsUntil("0001_ai_completion"));
    sqlite
      .prepare(
        "INSERT INTO imports (id, status, photo_path, corners, draft, ai_cells, created_at) VALUES (7, 'ready', 'imports/7.jpg', '{}', '{\"courseName\":\"BETHPAGE BLACK\"}', '[\"player0:9\"]', 0)",
      )
      .run();

    migrateDatabase(opened.db);

    expect(
      sqlite
        .prepare("SELECT id, status, draft, ai_cells AS aiCells, correction FROM imports")
        .all(),
    ).toEqual([
      {
        id: 7,
        status: "ready",
        draft: '{"courseName":"BETHPAGE BLACK"}',
        aiCells: '["player0:9"]',
        correction: null,
      },
    ]);
  });
});
