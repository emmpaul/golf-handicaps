import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ScoreMark } from "@/components/scores/score-mark";

it.each([
  [3, "birdie"],
  [5, "bogey"],
] as const)("marks %i on par 4 as %s with spoken text", (strokes, mark) => {
  const html = renderToStaticMarkup(<ScoreMark strokes={strokes} par={4} />);
  expect(html).toContain(`data-mark="${mark}"`);
  expect(html.replace(/<[^>]+>/g, "")).toBe(`${strokes}, ${mark}`);
});
// Mutation: strokes <= par incorrectly marks a par as birdie.
it("leaves par unmarked", () => {
  const html = renderToStaticMarkup(<ScoreMark strokes={4} par={4} />);
  expect(html).not.toContain("data-mark");
  expect(html.replace(/<[^>]+>/g, "")).toBe("4");
});
