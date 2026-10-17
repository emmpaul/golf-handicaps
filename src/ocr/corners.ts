import type { Point } from "./homography";

/** The 4 panel corners on the photo, normalised to 0–1, clockwise from top left. */
export type Corners = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};
