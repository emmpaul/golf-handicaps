import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createImport, getImportStatus, importStatusLabel, recropImport } from "@/jobs/imports";
import { freshTestDb, NEW_CORNERS, NOW, referenceCorners } from "./helpers";

const testDb = freshTestDb();

const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const upload = () =>
  createImport(testDb().db, testDb().dir, { photo: PHOTO, corners: referenceCorners() }, NOW);

describe("createImport", () => {
  it("enregistre la photo sous uploads/<uuid>.jpg dans DATA_DIR", () => {
    const { photoPath } = upload();
    expect(photoPath).toMatch(/^uploads\/[0-9a-f-]{36}\.jpg$/);
    expect(readFileSync(join(testDb().dir, photoPath))).toEqual(PHOTO);
  });

  it("crée l'import en attente avec ses coins et un job ocr-scorecard qui le vise", () => {
    const { id, photoPath } = upload();
    expect(
      testDb().sqlite.prepare("SELECT status, photo_path, corners FROM imports").all(),
    ).toEqual([
      { status: "queued", photo_path: photoPath, corners: JSON.stringify(referenceCorners()) },
    ]);
    expect(testDb().sqlite.prepare("SELECT type, payload, status FROM jobs").all()).toEqual([
      { type: "ocr-scorecard", payload: JSON.stringify({ importId: id }), status: "queued" },
    ]);
  });

  it("ne garde ni l'import ni la photo si le job ne peut pas être créé (même transaction)", () => {
    testDb().sqlite.exec("DROP TABLE jobs");
    expect(upload).toThrow(/no such table: jobs/);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(0);
    expect(readdirSync(join(testDb().dir, "uploads"))).toEqual([]);
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
  it("renvoie l'état affiché et le brouillon d'un import", () => {
    const { id } = upload();
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
  function failedImport() {
    const { id } = upload();
    testDb().sqlite.exec("UPDATE jobs SET status = 'failed', attempts = 2");
    testDb().sqlite.prepare("UPDATE imports SET status = 'failed' WHERE id = ?").run(id);
    return id;
  }

  it("remet un import en échec en attente avec ses nouveaux coins et un nouveau job", () => {
    const id = failedImport();
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

  it("efface la correction enregistrée : la nouvelle lecture repart de zéro", () => {
    const id = failedImport();
    testDb()
      .sqlite.prepare("UPDATE imports SET correction = ? WHERE id = ?")
      .run(JSON.stringify({ version: 1, card: { playedOn: "2026-10-13" } }), id);
    expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("queued");
    expect(testDb().sqlite.prepare("SELECT status, correction FROM imports").all()).toEqual([
      { status: "queued", correction: null },
    ]);
  });

  it("refuse de recadrer un import qui n'est pas en échec, sans rien changer", () => {
    const { id } = upload();
    expect(recropImport(testDb().db, id, NEW_CORNERS, NOW)).toBe("not-failed");
    expect(testDb().sqlite.prepare("SELECT status, corners FROM imports").all()).toEqual([
      { status: "queued", corners: JSON.stringify(referenceCorners()) },
    ]);
    expect(testDb().sqlite.prepare("SELECT count(*) FROM jobs").pluck().get()).toBe(1);
  });

  it("répond not-found pour un import inconnu", () => {
    expect(recropImport(testDb().db, 999, NEW_CORNERS, NOW)).toBe("not-found");
  });

  it("garde l'import en échec avec ses anciens coins si le job ne peut pas être créé", () => {
    const id = failedImport();
    testDb().sqlite.exec("DROP TABLE jobs");
    expect(() => recropImport(testDb().db, id, NEW_CORNERS, NOW)).toThrow(/no such table: jobs/);
    expect(testDb().sqlite.prepare("SELECT status, corners FROM imports").all()).toEqual([
      { status: "failed", corners: JSON.stringify(referenceCorners()) },
    ]);
  });
});
