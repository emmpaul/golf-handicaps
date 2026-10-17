import { describe, expect, it } from "vitest";
import { ORB_FOR, orbForImport } from "@/components/ui/pending";

describe("orbForImport", () => {
  it("fait respirer l'orbe d'un import en attente", () => {
    expect(orbForImport("queued")).toBe("breathing");
  });

  it("balaie le globe pendant la lecture", () => {
    expect(orbForImport("reading")).toBe("searching");
  });

  it("n'affiche pas d'orbe pour un import prêt à vérifier", () => {
    expect(orbForImport("ready")).toBeNull();
  });

  it("n'affiche pas d'orbe pour un import en échec", () => {
    expect(orbForImport("failed")).toBeNull();
  });
});

describe("ORB_FOR", () => {
  it("donne au redressement le contour qui passe du cercle au carré", () => {
    expect(ORB_FOR.rectify).toBe("shaping");
  });

  it("donne aux envois l'orbe de travail", () => {
    expect(ORB_FOR.send).toBe("working");
  });
});
