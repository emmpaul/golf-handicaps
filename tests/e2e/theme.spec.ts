import { referenceRound, seedRound } from "./data";
import { expect, test } from "./fixtures";

// Mutation: themeColor reset to "#ffffff" loses both media-specific tags. Mutation: body back on
// the Fairway paper (--color-paper oklch(0.970031 0.008232 91.4826)) → the light rgb goes red.
test("the score-board palette follows the system theme and status bar", async ({ page }) => {
  await page.goto("/rounds");
  const tags = page.locator('meta[name="theme-color"]');
  await expect(tags).toHaveCount(2);
  await expect(tags.nth(0)).toHaveAttribute("media", "(prefers-color-scheme: light)");
  await expect(tags.nth(0)).toHaveAttribute("content", "#F4F7FB");
  await expect(tags.nth(1)).toHaveAttribute("media", "(prefers-color-scheme: dark)");
  await expect(tags.nth(1)).toHaveAttribute("content", "#0A111F");
  for (const [colorScheme, expected] of [
    ["light", [244, 247, 251]],
    ["dark", [10, 17, 31]],
  ] as const) {
    await page.emulateMedia({ colorScheme });
    const rgb = await page.locator("body").evaluate((body) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = getComputedStyle(body).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    });
    // Chromium renders the OKLCH token through Tailwind's lab() at 243 for the 244 red channel:
    // each channel may differ from the hand-written hex by one step.
    expect(
      rgb.map((channel, index) => Math.abs(channel - expected[index]) <= 1),
      `${colorScheme} body ${rgb.join(", ")}`,
    ).toEqual([true, true, true]);
  }
});

test("index columns inherit tabular numerals", async ({ page, players }) => {
  seedRound(referenceRound(players));
  await page.goto("/handicaps");
  await expect(
    page
      .getByRole("table", { name: "Différentiels de Gab" })
      .locator("tbody tr")
      .first()
      .getByRole("cell")
      .nth(2),
  ).toHaveCSS("font-variant-numeric", "tabular-nums");
});
