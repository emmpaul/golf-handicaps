import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imports, rounds } from "@/db/schema";
import { convertStoredPhotos } from "@/jobs/convert-photos";
import { freshTestDb, NOW, referenceCorners } from "./helpers";

const testDb = freshTestDb();

/** Petit JPEG décodable, comme une photo stockée avant le passage au WebP. */
const JPEG = await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#2d6a4f" },
})
  .jpeg()
  .toBuffer();

const WEBP = await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#1b4332" },
})
  .webp()
  .toBuffer();

/** Écrit `content` sous `DATA_DIR/<photoPath>`. */
function store(photoPath: string, content: Buffer) {
  mkdirSync(join(testDb().dir, "uploads"), { recursive: true });
  writeFileSync(join(testDb().dir, photoPath), content);
}

function addImport(photoPath: string, roundId: number | null = null) {
  testDb()
    .db.insert(imports)
    .values({ photoPath, corners: referenceCorners(), roundId, createdAt: NOW })
    .run();
}

function addRound(photoPath: string): number {
  return testDb()
    .db.insert(rounds)
    .values({ courseName: "BETHPAGE BLACK", tees: "Red", playedOn: "2026-10-17", photoPath })
    .returning({ id: rounds.id })
    .get().id;
}

const importPaths = () =>
  testDb().sqlite.prepare("SELECT photo_path FROM imports ORDER BY id").pluck().all();
const roundPaths = () =>
  testDb().sqlite.prepare("SELECT photo_path FROM rounds ORDER BY id").pluck().all();
const uploads = () => readdirSync(join(testDb().dir, "uploads")).sort();
const header = (photoPath: string) => {
  const file = readFileSync(join(testDb().dir, photoPath));
  return [file.subarray(0, 4).toString("ascii"), file.subarray(8, 12).toString("ascii")];
};

const convert = () => convertStoredPhotos(testDb().db, testDb().dir);

const SHARED = "uploads/11111111-1111-4111-8111-111111111111.jpg";
const SHARED_WEBP = "uploads/11111111-1111-4111-8111-111111111111.webp";
const CORRUPT = "uploads/22222222-2222-4222-8222-222222222222.jpg";
const VALID = "uploads/33333333-3333-4333-8333-333333333333.jpg";
const VALID_WEBP = "uploads/33333333-3333-4333-8333-333333333333.webp";
const ALREADY = "uploads/44444444-4444-4444-8444-444444444444.webp";
const MISSING = "uploads/55555555-5555-4555-8555-555555555555.jpg";

describe("convertStoredPhotos", () => {
  // Les échecs sont journalisés en avertissement ; on les garde hors de la sortie des tests.
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Mutation : retirer la mise à jour de `rounds` → le round pointe encore vers le .jpg.
  it("convertit la photo partagée par un import et son round : les deux pointent vers le même .webp", async () => {
    store(SHARED, JPEG);
    const roundId = addRound(SHARED);
    addImport(SHARED, roundId);

    expect(await convert()).toEqual({ converted: 1, failed: [] });
    expect(importPaths()).toEqual([SHARED_WEBP]);
    expect(roundPaths()).toEqual([SHARED_WEBP]);
    expect(uploads()).toEqual(["11111111-1111-4111-8111-111111111111.webp"]);
    expect(header(SHARED_WEBP)).toEqual(["RIFF", "WEBP"]);
  });

  // Mutation : retirer le filtre `.webp` → le second appel reconvertit la photo.
  it("un second appel ne reconvertit rien et laisse les fichiers inchangés", async () => {
    store(SHARED, JPEG);
    addImport(SHARED);
    await convert();
    const before = readFileSync(join(testDb().dir, SHARED_WEBP));

    expect(await convert()).toEqual({ converted: 0, failed: [] });
    expect(importPaths()).toEqual([SHARED_WEBP]);
    expect(uploads()).toEqual(["11111111-1111-4111-8111-111111111111.webp"]);
    expect(readFileSync(join(testDb().dir, SHARED_WEBP)).equals(before)).toBe(true);
  });

  // Mutation : retirer le `try/catch` par fichier → la conversion entière rejette.
  it("convertit le JPEG valide et laisse en place le corrompu, sans .webp orphelin", async () => {
    store(CORRUPT, Buffer.from("pas une image"));
    store(VALID, JPEG);
    addImport(CORRUPT);
    addImport(VALID);

    expect(await convert()).toEqual({ converted: 1, failed: [CORRUPT] });
    expect(importPaths()).toEqual([CORRUPT, VALID_WEBP]);
    expect(uploads()).toEqual([
      "22222222-2222-4222-8222-222222222222.jpg",
      "33333333-3333-4333-8333-333333333333.webp",
    ]);
    expect(readFileSync(join(testDb().dir, CORRUPT)).toString()).toBe("pas une image");
  });

  // Mutation : retirer le `try/catch` par fichier → la lecture du fichier absent rejette.
  it("un fichier absent est signalé en échec et sa ligne garde son chemin", async () => {
    store(VALID, JPEG);
    addImport(MISSING);
    addImport(VALID);

    expect(await convert()).toEqual({ converted: 1, failed: [MISSING] });
    expect(importPaths()).toEqual([MISSING, VALID_WEBP]);
  });

  // Mutation : retirer le `rm` du `catch` → le .webp écrit avant l'échec reste orphelin.
  it("une transaction en échec retire le .webp déjà écrit et garde le .jpg", async () => {
    store(VALID, JPEG);
    addImport(VALID);
    testDb().sqlite.exec(
      "CREATE TRIGGER block_update BEFORE UPDATE ON imports BEGIN SELECT RAISE(ABORT, 'bloqué'); END",
    );

    expect(await convert()).toEqual({ converted: 0, failed: [VALID] });
    expect(importPaths()).toEqual([VALID]);
    expect(uploads()).toEqual(["33333333-3333-4333-8333-333333333333.jpg"]);
    expect(readFileSync(join(testDb().dir, VALID)).equals(JPEG)).toBe(true);
  });

  // Mutation : retirer le filtre `.webp` → le WebP est relu, réécrit puis supprimé.
  it("ne touche pas une photo déjà en .webp", async () => {
    store(ALREADY, WEBP);
    addImport(ALREADY);

    expect(await convert()).toEqual({ converted: 0, failed: [] });
    expect(importPaths()).toEqual([ALREADY]);
    expect(uploads()).toEqual(["44444444-4444-4444-8444-444444444444.webp"]);
    expect(readFileSync(join(testDb().dir, ALREADY)).equals(WEBP)).toBe(true);
  });
});
