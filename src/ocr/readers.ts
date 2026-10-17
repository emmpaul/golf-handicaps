import type { CellReader } from "./cell-reader";
import { createTemplateCellReader } from "./template-reader";
import { createTesseractCellReader } from "./tesseract";

/** Digit templates first, native Tesseract when a glyph matches no template. */
export function createDefaultCellReader(): CellReader {
  return createTemplateCellReader(createTesseractCellReader());
}
