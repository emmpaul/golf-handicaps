import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { prepareDatabase } from "@/db/prepare";
import { listPlayers } from "@/server/players/players";

let dir: string | undefined;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("prepareDatabase (démarrage du web)", () => {
  it("migre une base vide puis crée Gab, Manu et Sean, une seule fois", () => {
    dir = mkdtempSync(join(tmpdir(), "golf-prepare-"));
    const { db, sqlite } = openDatabase(join(dir, "app.db"));
    prepareDatabase(db);
    prepareDatabase(db);
    expect(listPlayers(db).map(({ name }) => name)).toEqual(["Gab", "Manu", "Sean"]);
    sqlite.close();
  });
});
