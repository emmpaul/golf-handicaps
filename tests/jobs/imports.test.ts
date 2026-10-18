import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createImport,
  getImportStatus,
  importStatusLabel,
  recropImport,
  toStoredWebp,
  UnreadablePhotoError,
} from "@/jobs/imports";
import { referencePhoto } from "../ocr/reference";
import { freshTestDb, NEW_CORNERS, NOW, referenceCorners } from "./helpers";

const testDb = freshTestDb();

/** Petit JPEG décodable, comme celui que le navigateur envoie (en plus petit). */
const PHOTO = await sharp({
  create: { width: 8, height: 8, channels: 3, background: "#2d6a4f" },
})
  .jpeg()
  .toBuffer();

const upload = (photo = PHOTO) =>
  createImport(testDb().db, testDb().dir, { photo, corners: referenceCorners() }, NOW);

const uploadsDir = () => join(testDb().dir, "uploads");

describe("toStoredWebp", () => {
  // Mutation : `.jpeg()` à la place de `.webp()` → l'en-tête RIFF/WEBP manque.
  it("convertit un JPEG en WebP (en-tête RIFF, WEBP aux octets 8 à 11)", async () => {
    const webp = await toStoredWebp(referencePhoto().photo);
    expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  // Mutation : rendre le buffer reçu tel quel au lieu de le décoder.
  it("rejette un buffer qui n'est pas une image", async () => {
    await expect(toStoredWebp(Buffer.from("pas une image"))).rejects.toThrow(
      /unsupported image format/,
    );
  });
});

describe("createImport", () => {
  // Mutation : écrire le buffer reçu au lieu du WebP converti.
  it("enregistre la photo convertie en WebP sous uploads/<uuid>.webp, seul fichier du dossier", async () => {
    const { photoPath } = await upload();
    expect(photoPath).toMatch(/^uploads\/[0-9a-f-]{36}\.webp$/);
    const stored = readFileSync(join(testDb().dir, photoPath));
    expect([
      stored.subarray(0, 4).toString("ascii"),
      stored.subarray(8, 12).toString("ascii"),
    ]).toEqual(["RIFF", "WEBP"]);
    expect(readdirSync(uploadsDir())).toEqual([photoPath.slice("uploads/".length)]);
  });

  it("crée l'import en attente avec ses coins et un job ocr-scorecard qui le vise", async () => {
    const { id, photoPath } = await upload();
    expect(
      testDb().sqlite.prepare("SELECT status, photo_path, corners FROM imports").all(),
    ).toEqual([
      { status: "queued", photo_path: photoPath, corners: JSON.stringify(referenceCorners()) },
    ]);
    expect(testDb().sqlite.prepare("SELECT type, payload, status FROM jobs").all()).toEqual([
      { type: "ocr-scorecard", payload: JSON.stringify({ importId: id }), status: "queued" },
    ]);
  });

  it("ne garde ni l'import ni la photo si le job ne peut pas être créé (même transaction)", async () => {
    testDb().sqlite.exec("DROP TABLE jobs");
    await expect(upload()).rejects.toThrow(/no such table: jobs/);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(0);
    expect(readdirSync(uploadsDir())).toEqual([]);
  });

  // Mutation : écrire le fichier avant la conversion.
  it("n'écrit aucun fichier ni import si la photo n'est pas une image", async () => {
    const rejection = upload(Buffer.from("pas une image"));
    await expect(rejection).rejects.toThrow(UnreadablePhotoError);
    await expect(rejection).rejects.toThrow("Photo illisible");
    expect(testDb().sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(0);
    expect(existsSync(uploadsDir()) ? readdirSync(uploadsDir()) : []).toEqual([]);
  });
});

describe("importStatusLabel", () => {
  it.each([
    ["queued", "En attente"],
    ["reading", "Lecture en cours"],
    ["ready", "Prêt à vérifier"],
    ["failed", "Échec"],
  ] as const)("%s s'affiche « %s »", (status, label) => {
    expect(importStatusLabel(status)).toBe(label);
  });
});

describe("getImportStatus", () => {
  it("renvoie l'état affiché et le brouillon d'un import", async () => {
    const { id } = await upload();
    expect(getImportStatus(testDb().db, id)).toEqual({
      id,
      status: "queued",
      label: "En attente",
      draft: null,
    });
  });

  it("renvoie undefined pour un import inconnu", () => {
    expect(getImportStatus(testDb().db, 999)).toBeUndefined();
  });
});

describe("recropImport", () => {
  async function failedImport() {
    const { id } = await upload();
    testDb().sqlite.exec("UPDATE jobs SET status = 'failed', attempts = 2");
    testDb().sqlite.prepare("UPDATE imports SET status = 'failed' WHERE id = ?").run(id);
    return id;
  }

  it("remet un import en échec en attente avec ses nouveaux coins et un nouveau job", async () => {
    const id = await failedImport();
    expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("queued");
    expect(testDb().sqlite.prepare("SELECT status, corners FROM imports").all()).toEqual([
      { status: "queued", corners: JSON.stringify(NEW_CORNERS) },
    ]);
    expect(
      testDb().sqlite.prepare("SELECT type, payload, status, attempts FROM jobs ORDER BY id").all(),
    ).toEqual([
      {
        type: "ocr-scorecard",
        payload: JSON.stringify({ importId: id }),
        status: "failed",
        attempts: 2,
      },
      {
        type: "ocr-scorecard",
        payload: JSON.stringify({ importId: id }),
        status: "queued",
        attempts: 0,
      },
    ]);
  });

  it("efface la correction enregistrée : la nouvelle lecture repart de zéro", async () => {
    const id = await failedImport();
    testDb()
      .sqlite.prepare("UPDATE imports SET correction = ? WHERE id = ?")
      .run(JSON.stringify({ version: 1, card: { playedOn: "2026-10-13" } }), id);
    expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("queued");
    expect(testDb().sqlite.prepare("SELECT status, correction FROM imports").all()).toEqual([
      { status: "queued", correction: null },
    ]);
  });

  it("refuse de recadrer un import qui n'est pas en échec, sans rien changer", async () => {
    const { id } = await upload();
    expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("not-failed");
    expect(testDb().sqlite.prepare("SELECT status, corners FROM imports").all()).toEqual([
      { status: "queued", corners: JSON.stringify(referenceCorners()) },
    ]);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM jobs").pluck().get()).toBe(1);
  });

  it("répond not-found pour un import inconnu", () => {
    expect(recropImport(testDb().db, 999, NEW_CORNERS, NOW)).toBe("not-found");
  });

  it("garde l'import en échec avec ses anciens coins si le job ne peut pas être créé", async () => {
    const id = await failedImport();
    testDb().sqlite.exec("DROP TABLE jobs");
    expect(() => recropImport(testDb().db, id, NEW_CORNERS, NOW)).toThrow(/no such table: jobs/);
    expect(testDb().sqlite.prepare("SELECT status, corners FROM imports").all()).toEqual([
      { status: "failed", corners: JSON.stringify(referenceCorners()) },
    ]);
  });
});
