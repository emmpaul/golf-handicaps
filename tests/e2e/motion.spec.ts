import { referenceRound, seedRound } from "./data";
import { expect, test } from "./fixtures";

// Spec `visual-theme`, « Mouvement des contrôles » : avec le mouvement réduit, la confirmation
// s'ouvre sans glisser ni grandir.
test.use({ reducedMotion: "reduce" });

// Mutation : retirer `motion-reduce:animate-none` de `AlertDialogContent` (`alert-dialog.tsx`) →
// l'animation `enter` (fondu et zoom de tw-animate-css) est calculée à l'ouverture, rouge.
test("en mouvement réduit, la confirmation de suppression d'un round s'ouvre sans zoom ni transformation", async ({
  page,
  players,
}) => {
  await page.goto(`/rounds/${seedRound(referenceRound(players))}`);
  await page.getByRole("button", { name: "Supprimer" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Supprimer ce round ?" });
  await expect(dialog).toBeVisible();
  const computed = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return { animationName: style.animationName, transform: style.transform };
  });
  expect(computed).toEqual({ animationName: "none", transform: "none" });
});
