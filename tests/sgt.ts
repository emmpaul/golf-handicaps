import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Copies réduites de SGT (`tests/fixtures/sgt/README.md`). */
const FIXTURES = resolve(__dirname, "fixtures/sgt");

/** Page `/courses` de SGT réduite à une quinzaine de parcours, au format réel. */
export const SGT_COURSES_HTML = readFileSync(resolve(FIXTURES, "courses.html"), "utf8");

/** Carte SGT de Bethpage Black (id 30), telle que servie (905×527). */
export const SGT_SCORECARD_30 = readFileSync(resolve(FIXTURES, "scorecard_30.jpg"));

/**
 * Tees de la ligne « Slope/Rating » de la carte SGT de Bethpage Black (`scorecard_30.jpg`),
 * recopiés à la main, rating en dixièmes (77,5 → 775).
 */
export const BETHPAGE_TEES = [
  { name: "Blue", ratingT: 775, slope: 155 },
  { name: "White", ratingT: 742, slope: 148 },
  { name: "Red", ratingT: 714, slope: 144 },
  { name: "Junior", ratingT: 710, slope: 120 },
  { name: "PAR3", ratingT: 540, slope: 120 },
];
