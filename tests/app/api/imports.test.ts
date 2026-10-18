import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readEditorState, toSavedCorrection } from "@/components/round-editor/form-state";
import { listPlayers } from "@/server/players/players";
import { seedInitialPlayers } from "@/server/players/seed";
import { saveRound } from "@/server/rounds/save";
import { createTestDb, referenceForm, type TestDb } from "../../factories";
import { NEW_CORNERS, referenceCorners } from "../../jobs/helpers";

type Routes = {
  upload: typeof import("@/app/api/imports/route");
  status: typeof import("@/app/api/imports/[id]/route");
  recrop: typeof import("@/app/api/imports/[id]/corners/route");
  correction: typeof import("@/app/api/imports/[id]/correction/route");
};

let testDb: TestDb;
let routes: Routes;

beforeAll(async () => {
  testDb = createTestDb();
  vi.stubEnv("APP_PASSCODE", "birdie");
  vi.stubEnv("SESSION_SECRET", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("DATA_DIR", testDb.dir);
  routes = {
    upload: await import("@/app/api/imports/route"),
    status: await import("@/app/api/imports/[id]/route"),
    recrop: await import("@/app/api/imports/[id]/corners/route"),
    correction: await import("@/app/api/imports/[id]/correction/route"),
  };
});

afterAll(() => {
  vi.unstubAllEnvs();
  testDb.cleanup();
});

/** Petit JPEG décodable, comme celui que le navigateur envoie (en plus petit). */
const PHOTO = new Uint8Array(
  await sharp({ create: { width: 8, height: 8, channels: 3, background: "#2d6a4f" } })
    .jpeg()
    .toBuffer(),
);

function uploadRequest(fields: { photo?: Blob; corners?: string }) {
  const form = new FormData();
  if (fields.photo) form.set("photo", fields.photo, "carte.jpg");
  if (fields.corners !== undefined) form.set("corners", fields.corners);
  return new Request("http://localhost/api/imports", { method: "POST", body: form });
}

const statusOf = (id: string) =>
  routes.status.GET(new Request(`http://localhost/api/imports/${id}`), {
    params: Promise.resolve({ id }),
  });

describe("POST /api/imports", () => {
  it("enregistre la photo en WebP, crée l'import en attente et répond 201 avec son id", async () => {
    const response = await routes.upload.POST(
      uploadRequest({
        photo: new Blob([PHOTO], { type: "image/jpeg" }),
        corners: JSON.stringify(referenceCorners()),
      }),
    );
    expect(response.status).toBe(201);
    const { id } = await response.json();
    const row = testDb.sqlite
      .prepare("SELECT status, photo_path AS photoPath FROM imports WHERE id = ?")
      .get(id) as { status: string; photoPath: string };
    expect(row.status).toBe("queued");
    expect(row.photoPath).toMatch(/\.webp$/);
    expect(readFileSync(join(testDb.dir, row.photoPath)).subarray(8, 12).toString("ascii")).toBe(
      "WEBP",
    );
  });

  // Mutation : laisser remonter le rejet de la conversion (500) au lieu de répondre 400.
  it("refuse une photo qui n'est pas une image avec 400 « Photo illisible », sans import", async () => {
    const before = testDb.sqlite.prepare("SELECT count(*) FROM imports").pluck().get();
    const response = await routes.upload.POST(
      uploadRequest({
        photo: new Blob(["pas une image"], { type: "image/jpeg" }),
        corners: JSON.stringify(referenceCorners()),
      }),
    );
    expect([response.status, await response.json()]).toEqual([400, { error: "Photo illisible" }]);
    expect(testDb.sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(before);
  });

  it.each([
    ["sans photo", { corners: JSON.stringify(referenceCorners()) }, "Photo manquante"],
    ["sans coins", { photo: new Blob([PHOTO]) }, "Coins du panneau invalides"],
    [
      "avec un coin hors de la photo",
      {
        photo: new Blob([PHOTO]),
        corners: JSON.stringify({ ...referenceCorners(), topLeft: { x: 1.2, y: 0.2 } }),
      },
      "Coins du panneau invalides",
    ],
    [
      "avec des coins illisibles",
      { photo: new Blob([PHOTO]), corners: "{" },
      "Coins du panneau invalides",
    ],
  ])("refuse un envoi %s avec 400 et un message", async (_case, fields, error) => {
    const before = testDb.sqlite.prepare("SELECT count(*) FROM imports").pluck().get();
    const response = await routes.upload.POST(uploadRequest(fields));
    expect([response.status, await response.json()]).toEqual([400, { error }]);
    expect(testDb.sqlite.prepare("SELECT count(*) FROM imports").pluck().get()).toBe(before);
  });
});

describe("GET /api/imports/[id]", () => {
  it("renvoie l'état affiché d'un import", async () => {
    const created = await routes.upload.POST(
      uploadRequest({ photo: new Blob([PHOTO]), corners: JSON.stringify(referenceCorners()) }),
    );
    const { id } = await created.json();
    const response = await statusOf(String(id));
    expect([response.status, await response.json()]).toEqual([
      200,
      { id, status: "queued", label: "En attente", draft: null },
    ]);
  });

  it.each(["999", "abc"])("répond 404 pour l'import %s", async (id) => {
    const response = await statusOf(id);
    expect([response.status, await response.json()]).toEqual([
      404,
      { error: "Import introuvable" },
    ]);
  });
});

describe("POST /api/imports/[id]/corners", () => {
  async function createdImport(status: "queued" | "failed") {
    const created = await routes.upload.POST(
      uploadRequest({ photo: new Blob([PHOTO]), corners: JSON.stringify(referenceCorners()) }),
    );
    const { id } = (await created.json()) as { id: number };
    testDb.sqlite.prepare("UPDATE imports SET status = ? WHERE id = ?").run(status, id);
    return String(id);
  }

  const recrop = (id: string, body: string) =>
    routes.recrop.POST(
      new Request(`http://localhost/api/imports/${id}/corners`, { method: "POST", body }),
      { params: Promise.resolve({ id }) },
    );

  it("remet en attente un import en échec avec ses nouveaux coins", async () => {
    const id = await createdImport("failed");
    const response = await recrop(id, JSON.stringify(NEW_CORNERS));
    expect([response.status, await response.json()]).toEqual([
      200,
      { id: Number(id), status: "queued", label: "En attente", draft: null },
    ]);
    expect(testDb.sqlite.prepare("SELECT corners FROM imports WHERE id = ?").pluck().get(id)).toBe(
      JSON.stringify(NEW_CORNERS),
    );
  });

  it.each([
    ["des coins invalides", "failed", "{", 400, "Coins du panneau invalides"],
    [
      "un import qui n'est pas en échec",
      "queued",
      null,
      409,
      "Seul un import en échec peut être recadré",
    ],
  ] as const)("refuse %s", async (_case, status, body, code, error) => {
    const id = await createdImport(status);
    const response = await recrop(id, body ?? JSON.stringify(NEW_CORNERS));
    expect([response.status, await response.json()]).toEqual([code, { error }]);
  });

  it.each(["999", "abc"])("répond 404 pour l'import %s", async (id) => {
    const response = await recrop(id, JSON.stringify(NEW_CORNERS));
    expect([response.status, await response.json()]).toEqual([
      404,
      { error: "Import introuvable" },
    ]);
  });
});

describe("PUT /api/imports/[id]/correction", () => {
  /** Correction de la carte de référence, lignes non associées. */
  const body = () =>
    JSON.stringify(toSavedCorrection(readEditorState(referenceForm([null, null]), true)));

  function seededImport(status: "queued" | "reading" | "ready" | "failed") {
    return String(
      testDb.sqlite
        .prepare(
          "INSERT INTO imports (status, photo_path, corners, created_at) VALUES (?, 'uploads/ref.jpg', '{}', 0)",
        )
        .run(status).lastInsertRowid,
    );
  }

  const put = (id: string, payload: string) =>
    routes.correction.PUT(
      new Request(`http://localhost/api/imports/${id}/correction`, {
        method: "PUT",
        body: payload,
      }),
      { params: Promise.resolve({ id }) },
    );

  // Mutation : réponse 200 avec un corps au lieu de 204.
  it("répond 204 sans corps et enregistre la correction d'un import prêt à vérifier", async () => {
    const id = seededImport("ready");
    const response = await put(id, body());
    expect([response.status, await response.text()]).toEqual([204, ""]);
    expect(
      testDb.sqlite.prepare("SELECT correction FROM imports WHERE id = ?").pluck().get(id),
    ).toBe(body());
  });

  // Mutation : renvoyer 400 au lieu de 409 pour un import lié à un round.
  it("répond 409 « Cette carte est déjà enregistrée » pour un import lié à un round", async () => {
    const id = seededImport("ready");
    seedInitialPlayers(testDb.db);
    const [gab, manu] = listPlayers(testDb.db).map((player) => player.id);
    saveRound(testDb.db, referenceForm([gab, manu]), { importId: Number(id) });
    const response = await put(id, body());
    expect([response.status, await response.json()]).toEqual([
      409,
      { error: "Cette carte est déjà enregistrée" },
    ]);
  });

  // Mutation : statut de lecture traduit en 404 ou en 204.
  it.each(["queued", "reading"] as const)(
    "répond 409 « Lecture en cours » pour un import au statut %s",
    async (status) => {
      const response = await put(seededImport(status), body());
      expect([response.status, await response.json()]).toEqual([
        409,
        { error: "Lecture en cours" },
      ]);
    },
  );

  // Mutation : corps illisible laissé remonter en 500 au lieu de 400.
  it.each([
    ["`players` à la place de `lines`", body().replace('"lines"', '"players"')],
    ["un JSON illisible", "{"],
  ])("répond 400 « Requête invalide » pour %s", async (_case, payload) => {
    const response = await put(seededImport("ready"), payload);
    expect([response.status, await response.json()]).toEqual([400, { error: "Requête invalide" }]);
  });

  it.each(["999", "abc"])("répond 404 « Import introuvable » pour l'import %s", async (id) => {
    const response = await put(id, body());
    expect([response.status, await response.json()]).toEqual([
      404,
      { error: "Import introuvable" },
    ]);
  });

  // Mutation : `/api/imports/…` exclu du contrôle de session du proxy.
  it("répond 401 sans session, via le proxy", async () => {
    const { proxy } = await import("@/proxy");
    const response = proxy(
      new NextRequest("http://localhost/api/imports/1/correction", { method: "PUT", body: body() }),
    );
    expect([response.status, await response.json()]).toEqual([401, { error: "Session requise" }]);
  });
});
