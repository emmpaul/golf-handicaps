import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createImport,
  deleteImport,
  getImportStatus,
  importStatusLabel,
  recropImport,
  removeUnreferencedPhoto,
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

describe("recropImport", () => {
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

describe("removeUnreferencedPhoto", () => {
  const PHOTO_PATH = "uploads/photo-partagee.webp";

  /** Écrit un fichier factice sous `DATA_DIR/uploads/photo-partagee.webp`. */
  function writePhoto() {
    mkdirSync(uploadsDir(), { recursive: true });
    writeFileSync(join(testDb().dir, PHOTO_PATH), "webp");
  }

  const photoExists = () => existsSync(join(testDb().dir, PHOTO_PATH));

  it("efface une photo qu'aucune ligne ne référence", async () => {
    writePhoto();
    await removeUnreferencedPhoto(testDb().db, testDb().dir, PHOTO_PATH);
    expect(photoExists()).toBe(false);
  });

  // Mutation : supprimer le contrôle des références efface le fichier du round.
  it("garde une photo encore portée par un round", async () => {
    writePhoto();
    testDb()
      .sqlite.prepare(
        "INSERT INTO rounds (course_name, tees, played_on, created_at, photo_path) VALUES ('BETHPAGE BLACK', 'Red', '2026-10-17', 0, ?)",
      )
      .run(PHOTO_PATH);
    await removeUnreferencedPhoto(testDb().db, testDb().dir, PHOTO_PATH);
    expect(photoExists()).toBe(true);
  });

  // Mutation : ne contrôler que les rounds efface le fichier de l'import restant.
  it("garde une photo encore portée par un import", async () => {
    writePhoto();
    testDb()
      .sqlite.prepare(
        "INSERT INTO imports (status, photo_path, created_at) VALUES ('failed', ?, 0)",
      )
      .run(PHOTO_PATH);
    await removeUnreferencedPhoto(testDb().db, testDb().dir, PHOTO_PATH);
    expect(photoExists()).toBe(true);
  });

  // Mutation : `rm` sans `force`, ou erreur non attrapée → rejet ENOENT.
  it("ne rejette pas quand le fichier est déjà absent", async () => {
    await expect(
      removeUnreferencedPhoto(testDb().db, testDb().dir, PHOTO_PATH),
    ).resolves.toBeUndefined();
  });
});

describe("deleteImport", () => {
  const importRows = () =>
    testDb().sqlite.prepare("SELECT id, status, round_id AS roundId FROM imports").all();
  const jobRows = () =>
    testDb().sqlite.prepare("SELECT payload, status FROM jobs ORDER BY id").all();

  it("supprime un import en échec et renvoie le chemin de sa photo", async () => {
    const id = await importIn("failed");
    const { photoPath } = testDb()
      .sqlite.prepare("SELECT photo_path AS photoPath FROM imports WHERE id = ?")
      .get(id) as { photoPath: string };
    expect(deleteImport(testDb().db, id)).toEqual({ result: "deleted", photoPath });
    expect(importRows()).toEqual([]);
  });

  // Mutation : oublier de supprimer le job laisse 1 job `queued` de plus.
  it("supprime un import en attente et son job en file, sans toucher au job d'un autre import", async () => {
    const deleted = await upload();
    const kept = await upload();
    expect(deleteImport(testDb().db, deleted.id)).toEqual({
      result: "deleted",
      photoPath: deleted.photoPath,
    });
    expect(importRows()).toEqual([{ id: kept.id, status: "queued", roundId: null }]);
    expect(jobRows()).toEqual([
      { payload: JSON.stringify({ importId: kept.id }), status: "queued" },
    ]);
  });

  // Design, décision 2 : le job déjà réservé finit seul, sans effet. Mutation : supprimer les
  // jobs de l'import quel que soit leur statut.
  it("laisse le job déjà réservé (running) d'un import encore en attente", async () => {
    const { id } = await upload();
    testDb().sqlite.exec("UPDATE jobs SET status = 'running'");
    expect(deleteImport(testDb().db, id)).toMatchObject({ result: "deleted" });
    expect(jobRows()).toEqual([{ payload: JSON.stringify({ importId: id }), status: "running" }]);
  });

  it("supprime un import prêt à vérifier avec sa correction", async () => {
    const id = await importIn("ready");
    testDb()
      .sqlite.prepare("UPDATE imports SET correction = ? WHERE id = ?")
      .run(JSON.stringify({ version: 1, card: { playedOn: "2026-10-13" } }), id);
    expect(deleteImport(testDb().db, id)).toMatchObject({ result: "deleted" });
    expect(importRows()).toEqual([]);
  });

  // Mutation : ne pas refuser le statut `reading` supprime l'import en lecture.
  it("refuse un import en lecture, ligne et job intacts", async () => {
    const { id } = await upload();
    testDb().sqlite.prepare("UPDATE imports SET status = 'reading' WHERE id = ?").run(id);
    expect(deleteImport(testDb().db, id)).toEqual({ result: "reading" });
    expect(importRows()).toEqual([{ id, status: "reading", roundId: null }]);
    expect(jobRows()).toEqual([{ payload: JSON.stringify({ importId: id }), status: "queued" }]);
  });

  // Mutation : retirer le test de `round_id` fait passer l'import lié à `"deleted"`.
  it("refuse un import enregistré en round, sans rien changer", async () => {
    const id = await savedImport();
    const before = importRows();
    expect(deleteImport(testDb().db, id)).toEqual({ result: "already-saved" });
    expect(importRows()).toEqual(before);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM rounds").pluck().get()).toBe(1);
  });

  it("répond not-found pour un import inconnu", () => {
    expect(deleteImport(testDb().db, 999)).toEqual({ result: "not-found" });
  });
});
