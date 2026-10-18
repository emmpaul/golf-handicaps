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

const upload = (photo = PHOTO) => createImport(testDb().db, testDb().dir, { photo }, NOW);

const uploadsDir = () => join(testDb().dir, "uploads");

describe("toStoredWebp", () => {
  // Mutation : `.jpeg()` à la place de `.webp()` → l'en-tête RIFF/WEBP manque.
  // 60 s : encode la photo de référence en taille réelle, premier appel à sharp du fichier, et en
  // CI les fichiers qui lancent Tesseract se disputent les 4 vCPU ; il a déjà pris plus de 5 s.
  it("convertit un JPEG en WebP (en-tête RIFF, WEBP aux octets 8 à 11)", async () => {
    const webp = await toStoredWebp(referencePhoto().photo);
    expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
  }, 60_000);

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

  // Le cadrage est cherché par le worker (design, décision 1). Mutation : écrire des coins par
  // défaut à la création.
  it("crée l'import en attente sans coins et un job ocr-scorecard qui le vise", async () => {
    const { id, photoPath } = await upload();
    expect(
      testDb()
        .sqlite.prepare("SELECT status, photo_path, corners, corners_source FROM imports")
        .all(),
    ).toEqual([{ status: "queued", photo_path: photoPath, corners: null, corners_source: null }]);
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
  /** Import créé puis passé à `status`, ses coins détectés enregistrés, son job terminé. */
  async function importIn(status: "queued" | "reading" | "ready" | "failed") {
    const { id } = await upload();
    testDb().sqlite.exec("UPDATE jobs SET status = 'failed', attempts = 2");
    testDb()
      .sqlite.prepare(
        "UPDATE imports SET status = ?, corners = ?, corners_source = 'auto' WHERE id = ?",
      )
      .run(status, JSON.stringify(referenceCorners()), id);
    return id;
  }

  /** Import prêt à vérifier déjà enregistré en round. */
  async function savedImport() {
    const id = await importIn("ready");
    const roundId = testDb()
      .sqlite.prepare(
        "INSERT INTO rounds (course_name, tees, played_on, created_at) VALUES ('BETHPAGE BLACK', 'Red', '2026-10-17', 0)",
      )
      .run().lastInsertRowid;
    testDb().sqlite.prepare("UPDATE imports SET round_id = ? WHERE id = ?").run(roundId, id);
    return id;
  }

  const importRow = () =>
    testDb().sqlite.prepare("SELECT status, corners, corners_source AS source FROM imports").get();

  // En échec, ou prêt à vérifier sans round (spec « Nouvelle lecture après recadrage »).
  // Mutations : ne pas écrire `corners_source` (la provenance reste `auto`) ; n'accepter que
  // `failed` (refus de l'import prêt).
  it.each([
    ["en échec", "failed"],
    ["prêt à vérifier sans round", "ready"],
  ] as const)(
    "remet un import %s en attente avec ses coins placés à la main et un nouveau job",
    async (_case, status) => {
      const id = await importIn(status);
      expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("queued");
      expect(importRow()).toEqual({
        status: "queued",
        corners: JSON.stringify(NEW_CORNERS),
        source: "manual",
      });
      expect(
        testDb()
          .sqlite.prepare("SELECT type, payload, status, attempts FROM jobs ORDER BY id")
          .all(),
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
    },
  );

  it.each(["failed", "ready"] as const)(
    "efface la correction enregistrée d'un import %s : la nouvelle lecture repart de zéro",
    async (status) => {
      const id = await importIn(status);
      testDb()
        .sqlite.prepare("UPDATE imports SET correction = ? WHERE id = ?")
        .run(JSON.stringify({ version: 1, card: { playedOn: "2026-10-13" } }), id);
      expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("queued");
      expect(testDb().sqlite.prepare("SELECT status, correction FROM imports").all()).toEqual([
        { status: "queued", correction: null },
      ]);
    },
  );

  // Mutation : accepter tout import `ready`, ou tout statut autre que `failed`.
  it.each([
    ["prêt à vérifier déjà enregistré en round", savedImport],
    ["en attente", () => importIn("queued")],
    ["en lecture", () => importIn("reading")],
  ])("refuse de recadrer un import %s, sans rien changer", async (_case, create) => {
    const id = await create();
    const before = importRow();
    expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("not-recroppable");
    expect(importRow()).toEqual(before);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM jobs").pluck().get()).toBe(1);
  });

  it("répond not-found pour un import inconnu", () => {
    expect(recropImport(testDb().db, 999, NEW_CORNERS, NOW)).toBe("not-found");
  });

  it("garde l'import en échec avec ses anciens coins si le job ne peut pas être créé", async () => {
    const id = await importIn("failed");
    testDb().sqlite.exec("DROP TABLE jobs");
    expect(() => recropImport(testDb().db, id, NEW_CORNERS, NOW)).toThrow(/no such table: jobs/);
    expect(importRow()).toEqual({
      status: "failed",
      corners: JSON.stringify(referenceCorners()),
      source: "auto",
    });
  });
});
