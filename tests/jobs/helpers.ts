import type Database from "better-sqlite3";
import sharp from "sharp";
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

/** Plus grand écart, sur un axe, entre deux cadrages (fractions de la photo) ; NaN sans cadrage. */
export function cornersDeviation(actual: Corners | null | undefined, expected: Corners): number {
  if (!actual) return Number.NaN;
  return Math.max(
    ...(["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).flatMap((key) => [
      Math.abs(actual[key].x - expected[key].x),
      Math.abs(actual[key].y - expected[key].y),
    ]),
  );
}

/**
 * La référence avec une barre blanche de 40 × 900 px qui descend du bord haut de la photo
 * jusque dans le tableau (x 1480 à 1520) : le tableau touche le bord, donc la détection sur
 * toute la photo échoue. Limitée à la zone d'un cadrage de l'IA, elle retrouve le panneau.
 */
export async function referenceWithTopBar(): Promise<Buffer> {
  const bar = await sharp({
    create: { width: 40, height: 900, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  return sharp(referencePhoto().photo)
    .composite([{ input: bar, left: 1480, top: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

/** Coins de la référence rentrés de 0,02 sur chaque axe : un cadrage approximatif de l'IA. */
export function insetReferenceCorners(): Corners {
  const { topLeft, topRight, bottomRight, bottomLeft } = referenceCorners();
  return {
    topLeft: { x: topLeft.x + 0.02, y: topLeft.y + 0.02 },
    topRight: { x: topRight.x - 0.02, y: topRight.y + 0.02 },
    bottomRight: { x: bottomRight.x - 0.02, y: bottomRight.y - 0.02 },
    bottomLeft: { x: bottomLeft.x + 0.02, y: bottomLeft.y - 0.02 },
  };
}
