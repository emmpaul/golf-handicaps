import type Database from "better-sqlite3";
import { afterEach, beforeEach } from "vitest";
import type { Corners } from "@/ocr/corners";
import { createTestDb, type TestDb } from "../factories";
import { referencePhoto } from "../ocr/reference";

/** Instant fixe des tests de la file : le soir du round de référence. */
export const NOW = new Date("2026-10-17T20:00:00.000Z");

/** Coins mesurés à la main de la photo de référence IMG_3064. */
export const referenceCorners = (): Corners => referencePhoto().corners;

/** Base temporaire neuve pour chaque test du fichier. */
export function freshTestDb(): () => TestDb {
  let testDb: TestDb | undefined;
  beforeEach(() => {
    testDb = createTestDb();
  });
  afterEach(() => {
    testDb?.cleanup();
  });
  return () => {
    if (!testDb) throw new Error("freshTestDb() : base lue hors d'un test");
    return testDb;
  };
}

/** État du job unique de la base. */
export const jobRow = (sqlite: Database.Database) =>
  sqlite.prepare("SELECT status, attempts, last_error AS lastError FROM jobs").get();

/** Simule un worker tué en plein job : `running`, `attempts` tentatives, verrouillé à `lockedAt` (ms). */
export function markRunning(sqlite: Database.Database, id: number, lockedAt: number, attempts = 1) {
  sqlite
    .prepare("UPDATE jobs SET status = 'running', attempts = ?, locked_at = ? WHERE id = ?")
    .run(attempts, lockedAt, id);
}

/** `minutes` (+ `ms`) avant NOW, en ms. */
export const minutesBefore = (minutes: number, ms = 0) =>
  new Date(NOW.getTime() - minutes * 60_000 - ms).getTime();

/** Coins d'un recadrage, différents de ceux de la photo de référence. */
export const NEW_CORNERS: Corners = {
  topLeft: { x: 0.2, y: 0.25 },
  topRight: { x: 0.8, y: 0.25 },
  bottomRight: { x: 0.8, y: 0.75 },
  bottomLeft: { x: 0.2, y: 0.75 },
};
