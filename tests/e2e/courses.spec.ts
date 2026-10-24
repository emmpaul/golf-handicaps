import type { Page } from "@playwright/test";
import { referenceRound, scoresOverPar, seedProposedBethpageRed, seedRound } from "./data";
import { expect, test } from "./fixtures";
import { planGabAndManuOnBethpage } from "./strokes";

const courseCard = (page: Page, label: string) =>
  page.getByRole("list", { name: "Parcours" }).getByRole("listitem", { name: label, exact: true });

/**
 * Deux rounds de Gab et Manu sur « Paynes Valley / Blue », sans rating : Gab −4 puis +6,
 * Manu +17 puis +18. Index juste avant le round de référence : Gab 1,0, Manu 17,5.
 */
function seedPaynesValleyRounds(players: { Gab: number; Manu: number }) {
  for (const [day, gab, manu] of [
    ["01", -4, 17],
    ["02", 6, 18],
  ] as const) {
    const round = referenceRound(players, {
      courseName: "Paynes Valley",
      tees: "Blue",
      playedOn: `2026-10-${day}`,
    });
    seedRound({
      ...round,
      players: [
        { ...round.players[0], scores: scoresOverPar(gab) },
        { ...round.players[1], scores: scoresOverPar(manu) },
      ],
    });
  }
}

// Spec `course-rating`, « Parcours en attente de confirmation » et « Confirmation » ; spec
// `rounds`, « Classement net avec rating » ; spec `match-strokes`, « Mode Écart avec rating ».
// Mutation : `recomputeStats` retiré de la confirmation (Manu reçoit 27 coups), rating non
// passée à `matchStrokes` (17 coups), rating du round ignorée au classement (handicaps 1 et 18,
// Manu net 70), proposition lue sur le premier tee (Blue 77,5 / 155), ou nom et lieu du
// parcours SGT retenu absents de la carte.
test("confirmer 71,4 / 144 met Manu premier en net (65) et lui donne 21 coups en Écart", async ({
  page,
  players,
}) => {
  seedProposedBethpageRed();
  seedPaynesValleyRounds(players);
  const roundId = seedRound(referenceRound(players));

  await page.goto("/courses");
  const bethpage = courseCard(page, "Bethpage Black / Red");
  await expect(bethpage.getByTestId("course-rating")).toHaveText("sans rating");
  await expect(bethpage.getByTestId("course-proposal")).toHaveText(
    "Proposition : tee Red, 71,4 / 144",
  );
  await expect(bethpage.getByRole("link", { name: "Carte SGT" })).toHaveAttribute(
    "href",
    "https://simulatorgolftour.com/public/assets/courseImages/scorecards/scorecard_30.jpg",
  );
  await expect(bethpage.getByTestId("course-sgt")).toHaveText(
    "SGT : Bethpage Black · Farmingdale, NY",
  );
  await expect(bethpage.getByRole("link", { name: "The Course View" })).toHaveAttribute(
    "href",
    "https://thecourseview.com/courses/bethpage-black",
  );
  await bethpage.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(bethpage.getByTestId("course-rating")).toHaveText("71,4 / 144");
  await expect(bethpage.getByTestId("course-status")).toHaveText("Confirmé");

  await page.goto(`/rounds/${roundId}`);
  await expect(page.getByTestId("round-rating")).toHaveText("Rating 71,4 · slope 144");
  // Handicaps de parcours : 10 × 144 / 113 + 4 → 2 ; 175 × 144 / 113 + 4 → 23.
  await expect(page.getByRole("table", { name: "Classement net" }).getByRole("row")).toHaveText([
    "JoueurBrutHcp de jeuNetRang",
    "Gab722702",
    "Manu8823651",
  ]);

  // Index actuels, 3 rounds (meilleur − 2,0) : Gab −6,0 → −7 ; Manu 11,0 → 14 sur 71,4 / 144.
  await planGabAndManuOnBethpage(page);
  await expect(page.getByTestId("course-rating")).toHaveText("Rating 71,4 · slope 144");
  await expect(
    page
      .getByRole("list", { name: "Coups reçus" })
      .getByRole("listitem")
      .getByTestId("strokes-total"),
  ).toHaveText(["Gab ne reçoit aucun coup", "Manu reçoit 21 coups"]);
});

// Spec `course-rating`, « Valeurs hors bornes ». Mutation : borne du slope à 160, ou message
// du serveur non affiché.
test("un slope de 160 est refusé avec « Slope entre 55 et 155 » et rien n'est enregistré", async ({
  page,
  players,
}) => {
  seedProposedBethpageRed();
  seedRound(referenceRound(players));
  await page.goto("/courses");
  const bethpage = courseCard(page, "Bethpage Black / Red");
  await expect(bethpage.getByLabel("Rating de Bethpage Black / Red")).toHaveAttribute(
    "placeholder",
    "ex. 71,4",
  );
  await expect(bethpage.getByLabel("Slope de Bethpage Black / Red")).toHaveAttribute(
    "placeholder",
    "ex. 144",
  );
  await bethpage.getByLabel("Rating de Bethpage Black / Red").fill("71,4");
  await bethpage.getByLabel("Slope de Bethpage Black / Red").fill("160");
  await bethpage.getByRole("button", { name: "Enregistrer" }).click();
  await expect(bethpage.getByRole("alert")).toHaveText("Slope entre 55 et 155");
  await page.reload();
  await expect(courseCard(page, "Bethpage Black / Red").getByTestId("course-rating")).toHaveText(
    "sans rating",
  );
});

// Spec `course-rating`, « Navigation » : la page est atteinte depuis la liste des rounds.
// Mutation : lien « Parcours » retiré de `/rounds`.
test("le lien « Parcours » de la liste des rounds ouvre la page Parcours", async ({
  page,
  players,
}) => {
  seedRound(referenceRound(players));
  await page.goto("/rounds");
  await page.getByRole("link", { name: "Parcours", exact: true }).click();
  await page.waitForURL("**/courses");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parcours");
  await expect(courseCard(page, "Bethpage Black / Red").getByTestId("course-rating")).toHaveText(
    "sans rating",
  );
});
