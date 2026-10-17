import { beforeAll, describe, expect, it } from "vitest";
import { cropRelative, type GrayImage } from "@/ocr/image";
import { type Column, cellRect, type GridRow } from "@/ocr/layouts/gspro";
import { prepareCell } from "@/ocr/prepare-cell";
import { rectifyPanel } from "@/ocr/rectify";
import { referencePhoto } from "./reference";

const BLACK = 0;
const MARGIN = 12;

/** Black pixels on the edge of the upscaled cell, just inside the white margin. */
function blackOnCellBorder(image: GrayImage): number {
  const [first, lastX, lastY] = [MARGIN, image.width - MARGIN - 1, image.height - MARGIN - 1];
  let count = 0;
  for (let y = first; y <= lastY; y++) {
    for (let x = first; x <= lastX; x++) {
      const onBorder = x === first || y === first || x === lastX || y === lastY;
      if (onBorder && image.data[y * image.width + x] === BLACK) count++;
    }
  }
  return count;
}

function inkRatio(image: GrayImage): number {
  return image.data.filter((v) => v === BLACK).length / image.data.length;
}

let panel: GrayImage;
beforeAll(async () => {
  const { photo, corners } = referencePhoto();
  panel = await rectifyPanel(photo, corners);
});

const prepare = (row: GridRow, column: Column) =>
  prepareCell(cropRelative(panel, cellRect(row, column)));

describe("prepareCell", () => {
  it.each<[string, GridRow, Column]>([
    ["case sombre pleine, GAB trou 1", { player: 0 }, 1],
    ["rond rouge, GAB trou 7", { player: 0 }, 7],
    ["case encadrée, MANU trou 1", { player: 1 }, 1],
    ["chiffres imprimés, DISTANCE OUT", "distance", "out"],
  ])(
    "%s : chiffre noir sur fond blanc (2 à 35 % d'encre), aucun pixel noir au bord",
    (_name, row, column) => {
      const cell = prepare(row, column);
      expect(blackOnCellBorder(cell)).toBe(0);
      const ratio = inkRatio(cell);
      expect(ratio).toBeGreaterThan(0.02);
      expect(ratio).toBeLessThan(0.35);
    },
  );

  it("agrandit ×3 une case de score de 44 px et ajoute 12 px de marge blanche", () => {
    const cell = prepare({ player: 0 }, 1);
    expect([cell.width, cell.height]).toEqual([156, 156]);
    expect(new Set(cell.data)).toEqual(new Set([0, 255]));
  });
});
