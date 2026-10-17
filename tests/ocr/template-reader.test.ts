import { beforeAll, describe, expect, it } from "vitest";
import type { CellReader } from "@/ocr/cell-reader";
import { gridCells } from "@/ocr/grid";
import type { GrayImage } from "@/ocr/image";
import { rectifyPanel } from "@/ocr/rectify";
import { createTemplateCellReader } from "@/ocr/template-reader";
import { referencePhoto } from "./reference";

const NO_FALLBACK: CellReader = { read: async () => null };

let panel: GrayImage;
beforeAll(async () => {
  const { photo, corners } = referencePhoto();
  panel = await rectifyPanel(photo, corners);
});

describe("TemplateCellReader", () => {
  it("lit la ligne MANU avec les seuls modèles de chiffres", async () => {
    const reader = createTemplateCellReader(NO_FALLBACK);
    const manu = gridCells(panel, [false, true, false, false]).filter(
      (cell) => typeof cell.row !== "string",
    );
    const values = await Promise.all(manu.map((cell) => reader.read(cell.image)));
    expect(values).toEqual([7, 5, 3, 7, 6, 5, 5, 3, 5, 46, 3, 6, 5, 7, 4, 5, 4, 3, 5, 42, 88]);
  });

  it("passe la main au lecteur de repli quand le glyphe ne ressemble à aucun chiffre", async () => {
    // A solid 30×40 black block on white: far from every digit template.
    const width = 60;
    const data = new Uint8Array(width * 60).fill(255);
    for (let y = 10; y < 50; y++) data.fill(0, y * width + 15, y * width + 45);
    const reader = createTemplateCellReader({ read: async () => 42 });
    expect(await reader.read({ width, height: 60, data })).toBe(42);
  });

  it("rend null pour une case vide, sans appeler le repli", async () => {
    const reader = createTemplateCellReader({ read: async () => 42 });
    expect(await reader.read({ width: 60, height: 60, data: new Uint8Array(3600).fill(255) })).toBe(
      null,
    );
  });
});
