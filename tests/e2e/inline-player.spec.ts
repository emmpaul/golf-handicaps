import referenceDraft from "../fixtures/scorecards/gspro-img3064.draft.json";
import { seedReadyImport } from "./data";
import { saveButton } from "./editor";
import { expect, test } from "./fixtures";

/** Carte de référence dont la 2e ligne est lue « JULIEN », un nom inconnu. */
function julienImport() {
  const draft = structuredClone(referenceDraft);
  draft.players[1].name = "JULIEN";
  return seedReadyImport(draft);
}

test("une ligne « JULIEN » se rattache à un joueur créé sur place ; un doublon est refusé", async ({
  page,
}) => {
  await page.goto(`/imports/${julienImport()}`);
  const line = page.getByLabel("Joueur de la ligne 2");
  await expect(line).toHaveValue("");
  await expect(saveButton(page)).toHaveText("1 problème à corriger");

  await line.selectOption({ label: "Nouveau joueur…" });
  const name = page.getByLabel("Nom du nouveau joueur de la ligne 2");
  await name.fill("manu");
  await page.getByRole("button", { name: "Créer le joueur de la ligne 2" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Ce joueur" })).toHaveText(
    "Ce joueur existe déjà",
  );
  await expect(saveButton(page)).toHaveText("1 problème à corriger");

  await name.fill("Julien");
  await page.getByRole("button", { name: "Créer le joueur de la ligne 2" }).click();
  await expect(line.locator("option:checked")).toHaveText("Julien");
  await expect(name).toHaveCount(0);
  await expect(saveButton(page)).toHaveText("Enregistrer");
  await expect(page.getByLabel("Joueur de la ligne 1").locator("option")).toHaveText([
    "Choisir un joueur",
    "Gab",
    "Julien",
    "Manu",
    "Sean",
    "Nouveau joueur…",
  ]);

  await page.goto("/players");
  await expect(
    page.getByRole("list", { name: "Joueurs" }).getByRole("listitem").getByRole("heading"),
  ).toHaveText(["Gab", "Julien", "Manu", "Sean"]);
});
