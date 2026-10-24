import { referenceRound, seedRound } from "./data";
import { expect, test } from "./fixtures";

// Mutation: themeColor reset to "#ffffff" loses both media-specific tags.
test("Fairway follows the system theme and status bar", async ({ page }) => {
  await page.goto("/rounds");
  const tags = page.locator('meta[name="theme-color"]');
  await expect(tags).toHaveCount(2);
  await expect(tags.nth(0)).toHaveAttribute("media", "(prefers-color-scheme: light)");
  await expect(tags.nth(0)).toHaveAttribute("content", "#F7F5EF");
  await expect(tags.nth(1)).toHaveAttribute("media", "(prefers-color-scheme: dark)");
  await expect(tags.nth(1)).toHaveAttribute("content", "#0F1713");
  for (const [colorScheme, expected] of [
    ["light", [247, 245, 239]],
    ["dark", [15, 23, 19]],
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
    expect(rgb).toEqual(expected);
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
