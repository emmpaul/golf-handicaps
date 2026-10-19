import { expect, test } from "@playwright/test";

/**
 * Commit inscrit dans l'image : sans session, la route de version renvoie le sha passé au build
 * (`GIT_COMMIT`). EXPECTED_COMMIT est le même sha, fourni par la CI (`github.sha`).
 * Mutation : retirer le build-arg GIT_COMMIT de la CI fait rougir ce test (commit null).
 */
test("route de version sans session : commit de l'image", async ({ request }) => {
  const expectedCommit = process.env.EXPECTED_COMMIT;
  if (!expectedCommit)
    throw new Error("EXPECTED_COMMIT manquant : sha passé en GIT_COMMIT au build");

  const response = await request.get("/api/version");

  expect(response.status()).toBe(200);
  expect((await response.json()).commit).toBe(expectedCommit);
});
