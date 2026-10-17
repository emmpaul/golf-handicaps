import { describe, expect, it } from "vitest";
import { detectPlayerRows } from "@/ocr/grid";
import { rectifyPanel } from "@/ocr/rectify";
import { referencePhoto } from "./reference";

describe("detectPlayerRows", () => {
  it("détecte GAB et MANU, et les lignes 3 et 4 vides comme absentes", async () => {
    const { photo, corners } = referencePhoto();
    expect(detectPlayerRows(await rectifyPanel(photo, corners))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
