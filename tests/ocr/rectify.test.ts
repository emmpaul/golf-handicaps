import { describe, expect, it } from "vitest";
import { rectifyPanel } from "@/ocr/rectify";
import { meanIn, referencePhoto } from "./reference";

describe("rectifyPanel", () => {
  it("redresse la photo de référence à la taille du gabarit GSPro, 2400×1224", async () => {
    const { photo, corners } = referencePhoto();
    const panel = await rectifyPanel(photo, corners);
    expect([panel.width, panel.height]).toEqual([2400, 1224]);
    expect(panel.data.length).toBe(2400 * 1224);
  });

  it("place le bandeau sombre en haut et le tableau clair au milieu", async () => {
    const { photo, corners } = referencePhoto();
    const panel = await rectifyPanel(photo, corners);
    // Header band "BETHPAGE BLACK … SCORECARD": dark, between the course name and the title.
    expect(meanIn(panel, { x: 0.25, y: 0.02, width: 0.15, height: 0.04 })).toBeLessThan(80);
    // Empty rows 3 and 4 of the table: light.
    expect(meanIn(panel, { x: 0.4, y: 0.6, width: 0.2, height: 0.1 })).toBeGreaterThan(150);
  });
});
