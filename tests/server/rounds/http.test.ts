import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { knownCourses } from "@/server/rounds/courses";
import { deleteRoundRequest, postRound, putRound } from "@/server/rounds/http";
import { listRounds } from "@/server/rounds/list";
import { referenceForm, seededTestDbPerTest } from "../../factories";

const testDb = seededTestDbPerTest();

const reference = () => referenceForm([testDb.ids.Gab, testDb.ids.Manu]);
const reply = async (pending: Response | Promise<Response>) => {
  const response = await pending;
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
};
const roundIds = () => listRounds(testDb.db).map(({ id }) => id);

describe("POST /api/rounds", () => {
  // Mutation : mauvais statut, ou id absent de la réponse.
  it("enregistre une carte cohérente : 201 et l'id du round", async () => {
    expect(await reply(postRound(testDb.db, { form: reference() }))).toEqual({
      status: 201,
      body: { id: 1 },
    });
  });

  // Mutation : contrôles non rejoués côté serveur, problèmes absents de la réponse.
  it("refuse une carte incohérente : 422 avec les problèmes", async () => {
    const form = referenceForm([testDb.ids.Gab, null]);
    expect(await reply(postRound(testDb.db, { form }))).toEqual({
      status: 422,
      body: {
        error: "1 problème à corriger",
        problems: [{ message: "Ligne sans joueur", cells: ["player1:player"] }],
      },
    });
    expect(roundIds()).toEqual([]);
  });

  // Mutation : doublon enregistré sans avertissement, ou lien vers le round existant absent.
  it("avertit d'un doublon : 409, « Ce round semble déjà enregistré » et l'id existant", async () => {
    postRound(testDb.db, { form: reference() });
    expect(await reply(postRound(testDb.db, { form: reference() }))).toEqual({
      status: 409,
      body: { error: "Ce round semble déjà enregistré", duplicateOf: 1 },
    });
    expect(roundIds()).toEqual([1]);
  });

  // Mutation : `force` ignoré, l'utilisateur ne peut pas enregistrer quand même.
  it("enregistre quand même un doublon confirmé (force)", async () => {
    postRound(testDb.db, { form: reference() });
    expect((await reply(postRound(testDb.db, { form: reference(), force: true }))).status).toBe(
      201,
    );
    expect(roundIds()).toEqual([2, 1]);
  });

  // Mutation : corps non validé (exception au lieu d'une réponse 400).
  it.each([
    ["sans formulaire", {}],
    [
      "avec 17 pars",
      { form: { ...referenceForm(), par: { holes: [4], out: 4, in: 0, total: 4 } } },
    ],
    ["avec un parcours numérique", { form: { ...referenceForm(), courseName: 12 } }],
  ])("refuse un corps invalide (%s) : 400", async (_name, body) => {
    expect(await reply(postRound(testDb.db, body))).toEqual({
      status: 400,
      body: { error: "Requête invalide" },
    });
  });

  // Mutation : import inconnu transformé en 500.
  it("répond 404 pour un import inconnu", async () => {
    expect(await reply(postRound(testDb.db, { form: reference(), importId: 404 }))).toEqual({
      status: 404,
      body: { error: "Import introuvable" },
    });
  });
});

describe("PUT /api/rounds/:id", () => {
  // Mutation : le round corrigé se signale lui-même comme doublon (409).
  it("corrige la distance du trou 1 d'un round : 200", async () => {
    postRound(testDb.db, { form: reference() });
    const form = reference();
    form.distance.holes[0] = 421;
    expect(await reply(putRound(testDb.db, "1", { form }))).toEqual({
      status: 200,
      body: { id: 1 },
    });
    expect(knownCourses(testDb.db).map(({ distances }) => distances[0])).toEqual([421]);
  });

  // Mutation : doublon d'un autre round non détecté à la correction.
  it("avertit si la correction le rend identique à un autre round : 409", async () => {
    postRound(testDb.db, { form: reference() });
    const blue = reference();
    blue.tees = "Blue";
    postRound(testDb.db, { form: blue });
    expect(await reply(putRound(testDb.db, "2", { form: reference() }))).toEqual({
      status: 409,
      body: { error: "Ce round semble déjà enregistré", duplicateOf: 1 },
    });
  });
});

describe("round introuvable", () => {
  // Mutation : id inconnu ou non numérique transformé en 500 ou en 204.
  it.each([
    ["PUT", () => putRound(testDb.db, "404", { form: reference() })],
    ["PUT sur un id non numérique", () => putRound(testDb.db, "abc", { form: reference() })],
    ["DELETE", () => deleteRoundRequest(testDb.db, testDb.dir, "404")],
  ])("%s répond 404", async (_name, request) => {
    expect(await reply(request())).toEqual({ status: 404, body: { error: "Round introuvable" } });
  });
});

describe("DELETE /api/rounds/:id", () => {
  // Mutation : round non supprimé, ou statut autre que 204.
  it("supprime le round : 204", async () => {
    postRound(testDb.db, { form: reference() });
    expect(await reply(deleteRoundRequest(testDb.db, testDb.dir, "1"))).toEqual({
      status: 204,
      body: null,
    });
    expect(roundIds()).toEqual([]);
  });

  // Mutation : photo du round non effacée après la suppression.
  it("efface la photo d'un round importé : 204, puis le fichier n'existe plus", async () => {
    mkdirSync(join(testDb.dir, "uploads"));
    const photo = join(testDb.dir, "uploads", "7.webp");
    writeFileSync(photo, "photo");
    testDb.sqlite
      .prepare(
        "INSERT INTO imports (id, status, photo_path, corners, created_at) VALUES (7, 'ready', 'uploads/7.webp', '{}', 0)",
      )
      .run();
    postRound(testDb.db, { form: reference(), importId: 7 });
    expect(await reply(deleteRoundRequest(testDb.db, testDb.dir, "1"))).toEqual({
      status: 204,
      body: null,
    });
    expect(existsSync(photo)).toBe(false);
  });
});
