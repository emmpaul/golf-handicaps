import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../../factories";
import { NEW_CORNERS, referenceCorners } from "../../jobs/helpers";

type Routes = {
  upload: typeof import("@/app/api/imports/route");
  status: typeof import("@/app/api/imports/[id]/route");
  recrop: typeof import("@/app/api/imports/[id]/corners/route");
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
  };
});

afterAll(() => {
  vi.unstubAllEnvs();
  testDb.cleanup();
});

const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7]);

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
  it("enregistre la photo, crée l'import en attente et répond 201 avec son id", async () => {
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
    expect(new Uint8Array(readFileSync(join(testDb.dir, row.photoPath)))).toEqual(PHOTO);
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
