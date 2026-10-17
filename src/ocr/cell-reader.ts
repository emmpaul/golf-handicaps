import type { GrayImage } from "./image";

/** Reads the number in a prepared cell (black digits on white), or null if unreadable/empty. */
export interface CellReader {
  read(cell: GrayImage): Promise<number | null>;
}
