import { describe, expect, it } from "vitest";
import { cropRelative } from "@/ocr/image";
import { cellRect } from "@/ocr/layouts/gspro";
import { prepareCell } from "@/ocr/prepare-cell";
import { rectifyPanel } from "@/ocr/rectify";
import { createLimiter, createTesseractCellReader } from "@/ocr/tesseract";
import { referencePhoto } from "./reference";

describe("TesseractCellReader", () => {
  // 30 s : la vitesse des runners CI varie du simple au double et les fichiers qui lancent
  // Tesseract se disputent les 4 vCPU ; ce test a déjà pris 5 043 ms en CI.
  it("lit 16 dans la case INDEX du trou 2 avec le binaire tesseract natif", async () => {
    const { photo, corners } = referencePhoto();
    const panel = await rectifyPanel(photo, corners);
    const cell = prepareCell(cropRelative(panel, cellRect("strokeIndex", 2)));
    expect(await createTesseractCellReader().read(cell)).toBe(16);
  }, 30_000);
});

describe("createLimiter", () => {
  it("ne lance jamais plus de 4 lectures à la fois sur 6 demandées", async () => {
    const limit = createLimiter(4);
    let running = 0;
    let peak = 0;
    const task = () =>
      limit(async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running--;
      });
    await Promise.all([task(), task(), task(), task(), task(), task()]);
    expect(peak).toBe(4);
  });
});
