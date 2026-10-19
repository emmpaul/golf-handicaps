import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppVersion } from "@/components/app-version";

/** Lien rendu par le pied de page : `href` et texte visible. */
function renderedLink(version: string, commit: string | null) {
  const html = renderToStaticMarkup(<AppVersion version={version} commit={commit} />);
  const match = html.match(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/);
  return { href: match?.[1], text: match?.[2] };
}

describe("AppVersion", () => {
  // Mutation : afficher le sha complet fait rougir le texte attendu.
  it("affiche la version et le commit court, liés à la release", () => {
    expect(renderedLink("0.6.0", "4794e1b0c0ffee00000000000000000000000000")).toEqual({
      href: "https://github.com/emmpaul/golf-handicaps/releases/tag/v0.6.0",
      text: "v0.6.0 · 4794e1b",
    });
  });

  it("affiche la version seule sans commit connu", () => {
    expect(renderedLink("0.6.0", null)).toEqual({
      href: "https://github.com/emmpaul/golf-handicaps/releases/tag/v0.6.0",
      text: "v0.6.0",
    });
  });
});
