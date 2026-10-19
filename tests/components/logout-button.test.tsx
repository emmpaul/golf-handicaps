import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LogoutButton } from "@/components/logout-button";

/** Bouton rendu à l'intérieur d'un `form` : son `type` et son texte visible, `null` hors formulaire. */
function buttonInForm() {
  const html = renderToStaticMarkup(<LogoutButton />);
  const form = html.match(/<form\b[^>]*>([\s\S]*)<\/form>/)?.[1] ?? "";
  const button = form.match(/<button\b[^>]*\btype="([^"]*)"[^>]*>([^<]*)<\/button>/);
  return button ? { type: button[1], text: button[2] } : null;
}

describe("LogoutButton", () => {
  // Mutation : un lien vers /login au lieu d'un bouton de formulaire fait rougir ce test.
  it("rend un bouton « Se déconnecter » qui soumet son formulaire", () => {
    expect(buttonInForm()).toEqual({ type: "submit", text: "Se déconnecter" });
  });
});
