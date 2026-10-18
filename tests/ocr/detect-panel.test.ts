import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { Corners } from "@/ocr/corners";
import { acceptCorners, detectPanel, fitEdge, intersect } from "@/ocr/detect-panel";
import { rectifyPanel } from "@/ocr/rectify";
import { referencePhoto } from "./reference";

describe("fitEdge", () => {
  // Mutation : ne pas écarter les points aberrants → la pente et l'ordonnée s'éloignent de 2 et 1.
  it("retrouve y = 2x + 1 malgré 2 points aberrants", () => {
    const onLine = Array.from({ length: 20 }, (_, x) => ({ x, y: 2 * x + 1 }));
    const outliers = [
      { x: 5, y: 60 },
      { x: 15, y: -40 },
    ];
    const { slope, intercept } = fitEdge([...onLine, ...outliers]);
    expect(slope).toBeCloseTo(2, 6);
    expect(intercept).toBeCloseTo(1, 6);
  });

  // Comme le bord droit du tableau de la photo Calanova sur la copie de travail : une centaine de
  // rangées, dont les 22 du haut, d'un seul tenant, prolongées de 6 px par un encart translucide du
  // simulateur posé sur le bord. Mutation : un seul passage qui écarte 10 % des points → la pente
  // reste tirée par le bloc décalé.
  it("retrouve y = 0,01x + 680 quand les 22 premiers points sur 100 sont décalés de 6", () => {
    const points = Array.from({ length: 100 }, (_, x) => ({
      x,
      y: 0.01 * x + 680 + (x < 22 ? 6 : 0),
    }));
    const { slope, intercept } = fitEdge(points);
    expect(slope).toBeCloseTo(0.01, 6);
    expect(intercept).toBeCloseTo(680, 6);
  });
});

describe("intersect", () => {
  it("coupe les droites x = 10 et y = 20 en (10, 20)", () => {
    const p = intersect({ a: 1, b: 0, c: 10 }, { a: 0, b: 1, c: 20 });
    expect(p.x).toBeCloseTo(10, 9);
    expect(p.y).toBeCloseTo(20, 9);
  });
});

const FIXTURES = resolve(__dirname, "../fixtures/scorecards");

const FULL_IMAGE: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft: { x: 0, y: 1 },
};

/**
 * A 2400×1224 image laid out like a rectified GSPro panel: header band (y 0–200), table
 * (y 220–1065) and, when `name` is set, a black bar in the first player's name box.
 */
function syntheticPanel(look: { header: number; table: number; name: boolean }): Promise<Buffer> {
  const grey = (v: number) => `rgb(${v},${v},${v})`;
  const svg =
    `<svg width="2400" height="1224"><rect width="2400" height="1224" fill="${grey(40)}"/>` +
    `<rect width="2400" height="200" fill="${grey(look.header)}"/>` +
    `<rect y="220" width="2400" height="845" fill="${grey(look.table)}"/>` +
    (look.name ? `<rect x="100" y="480" width="150" height="25" fill="#000"/>` : "") +
    "</svg>";
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Uniform grey 200 image of the reference size, as a JPEG: a white wall, no card. */
function greyWall(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 2250, channels: 3, background: "#c8c8c8" } })
    .jpeg()
    .toBuffer();
}

describe("acceptCorners", () => {
  it("accepte les coins de la référence et rend le même panneau que rectifyPanel", async () => {
    const { photo, corners } = referencePhoto();
    const panel = await acceptCorners(photo, corners);
    const expected = await rectifyPanel(photo, corners);
    expect(panel?.width).toBe(2400);
    expect(panel?.height).toBe(1224);
    // Comparaison d'octets : `toEqual` sur 2,9 millions de pixels dépasse le délai du test.
    expect(Buffer.compare(Buffer.from(panel?.data ?? []), Buffer.from(expected.data))).toBe(0);
  });

  // Ordre antihoraire : refusés dès le contrôle de forme, et le panneau redressé, retourné le long
  // de sa diagonale, n'a ni bandeau sombre ni ligne de joueur. Mutation : retirer le contrôle de
  // forme, celui du bandeau et celui des lignes de joueur → ces coins sont acceptés.
  it("refuse des coins concaves (topRight et bottomLeft échangés)", async () => {
    const { photo, corners } = referencePhoto();
    const swapped: Corners = {
      ...corners,
      topRight: corners.bottomLeft,
      bottomLeft: corners.topRight,
    };
    expect(await acceptCorners(photo, swapped)).toBeNull();
  });

  // Un panneau synthétique complet, réduit à 10 % × 10 % d'une photo sombre de 3000×2250.
  // Mutation : retirer le contrôle de surface → ces coins sont acceptés.
  it("refuse un quadrilatère de 10 % × 10 % de la photo", async () => {
    const panel = await sharp(await syntheticPanel({ header: 40, table: 200, name: true }))
      .resize(300, 225, { fit: "fill" })
      .toBuffer();
    const photo = await sharp({
      create: { width: 3000, height: 2250, channels: 3, background: "#282828" },
    })
      .composite([{ input: panel, left: 1350, top: 1012 }])
      .jpeg()
      .toBuffer();
    const small: Corners = {
      topLeft: { x: 0.45, y: 0.45 },
      topRight: { x: 0.55, y: 0.45 },
      bottomRight: { x: 0.55, y: 0.55 },
      bottomLeft: { x: 0.45, y: 0.55 },
    };
    expect(await acceptCorners(photo, small)).toBeNull();
  });

  // Toute la largeur de la photo au-dessus du panneau, logo IDRA compris, sous le bord de l'écran :
  // un cinquième de la photo, bandeau sombre en haut. Le ciel y est gris moyen (médiane ≈ 105) et sans nom de joueur : le contrôle du tableau clair
  // et celui des lignes de joueur le refusent chacun. Mutation : retirer ces deux contrôles → ces
  // coins sont acceptés.
  it("refuse des coins qui encadrent le logo IDRA au-dessus du panneau", async () => {
    const { photo } = referencePhoto();
    const logo: Corners = {
      topLeft: { x: 0, y: 0.03 },
      topRight: { x: 1, y: 0.03 },
      bottomRight: { x: 1, y: 0.235 },
      bottomLeft: { x: 0, y: 0.235 },
    };
    expect(await acceptCorners(photo, logo)).toBeNull();
  });

  // Témoin : le panneau synthétique complet passe, donc chaque refus ci-dessous vient du seul
  // élément retiré.
  it("accepte un panneau synthétique avec bandeau sombre, tableau clair et un nom", async () => {
    const photo = await syntheticPanel({ header: 40, table: 200, name: true });
    expect(await acceptCorners(photo, FULL_IMAGE)).not.toBeNull();
  });

  // Mutation : retirer le contrôle des lignes de joueur → ce panneau est accepté.
  it("refuse un panneau sans aucune ligne de joueur", async () => {
    const photo = await syntheticPanel({ header: 40, table: 200, name: false });
    expect(await acceptCorners(photo, FULL_IMAGE)).toBeNull();
  });

  // Mutation : retirer le contrôle du tableau clair → ce panneau est accepté.
  it("refuse un panneau dont le tableau est gris moyen (médiane 120)", async () => {
    const photo = await syntheticPanel({ header: 40, table: 120, name: true });
    expect(await acceptCorners(photo, FULL_IMAGE)).toBeNull();
  });

  // Mutation : retirer le contrôle du bandeau sombre → ce panneau est accepté.
  it("refuse un panneau dont le bandeau est clair (médiane 200)", async () => {
    const photo = await syntheticPanel({ header: 200, table: 200, name: true });
    expect(await acceptCorners(photo, FULL_IMAGE)).toBeNull();
  });

  // Mutation : retirer le contrôle du bandeau et celui des lignes de joueur → ces coins sont acceptés.
  it("refuse les coins de la référence sur une image uniforme gris 200", async () => {
    const { corners } = referencePhoto();
    expect(await acceptCorners(await greyWall(), corners)).toBeNull();
  });

  // Les coins sont normalisés entre 0 et 1 (`Corners`, `parseCorners`) : un panneau qui dépasse
  // de la photo n'est pas représentable.
  // Mutation : retirer le contrôle des bornes → ces coins sont acceptés.
  it("refuse un coin hors de la photo", async () => {
    const { photo, corners } = referencePhoto();
    const outside: Corners = { ...corners, topLeft: { x: -0.005, y: corners.topLeft.y } };
    expect(await acceptCorners(photo, outside)).toBeNull();
  });
});

/** Each corner within `tolerance` of the expected one, on each axis (fractions of the photo). */
function expectCornersNear(
  actual: Corners | undefined,
  expected: Corners,
  tolerance: number,
): void {
  for (const key of ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const) {
    expect(Math.abs((actual?.[key].x ?? Number.NaN) - expected[key].x), `${key}.x`).toBeLessThan(
      tolerance,
    );
    expect(Math.abs((actual?.[key].y ?? Number.NaN) - expected[key].y), `${key}.y`).toBeLessThan(
      tolerance,
    );
  }
}

describe("detectPanel", () => {
  it("trouve les coins de la référence à moins de 0,01 de ceux mesurés à la main", async () => {
    const { photo, corners } = referencePhoto();
    const found = await detectPanel(photo);
    expectCornersNear(found?.corners, corners, 0.01);
    expect([found?.panel.width, found?.panel.height]).toEqual([2400, 1224]);
  });

  // Photos réelles du groupe 1 (`tests/fixtures/scorecards/README.md`). Coins attendus recopiés à
  // la main depuis leur `.corners.json`. Mutation : `OUTLIER_SHARE` à 0,1 → l'encart translucide
  // posé sur le bord droit du tableau de Calanova tire le coin haut droit à plus de 0,01.
  it.each([
    {
      photo: "gspro-paynes-valley.jpg",
      corners: {
        topLeft: { x: 0.10682, y: 0.18769 },
        topRight: { x: 0.84453, y: 0.24019 },
        bottomRight: { x: 0.80885, y: 0.84602 },
        bottomLeft: { x: 0.12948, y: 0.85417 },
      },
    },
    {
      photo: "gspro-calanova.jpg",
      corners: {
        topLeft: { x: 0.0212, y: 0.3995 },
        topRight: { x: 0.90524, y: 0.37613 },
        bottomRight: { x: 0.91098, y: 0.72573 },
        bottomLeft: { x: 0.03982, y: 0.7272 },
      },
    },
  ])("trouve les coins de $photo à moins de 0,01 de ceux mesurés à la main", async (fixture) => {
    const found = await detectPanel(readFileSync(resolve(FIXTURES, fixture.photo)));
    expectCornersNear(found?.corners, fixture.corners, 0.01);
    expect([found?.panel.width, found?.panel.height]).toEqual([2400, 1224]);
  });

  // Le cadre de la photo coupe le bord gauche du panneau (coin haut gauche mesuré à x ≈ -0,0047) :
  // pas de coins représentables, la détection locale doit laisser la main à l'IA ou au cadrage
  // manuel. Deux garde-fous le refusent chacun : le tableau touche le bord de la photo, et, s'il
  // était gardé, ses coins, ramenés sur le bord, placent le bandeau sur le ciel du simulateur.
  // Mutation : garder les composantes qui touchent le bord et retirer le contrôle du bandeau
  // sombre → un cadrage est trouvé.
  it("ne trouve rien sur gspro-tualatin.jpg, dont le panneau sort de la photo", async () => {
    expect(await detectPanel(readFileSync(resolve(FIXTURES, "gspro-tualatin.jpg")))).toBeNull();
  });

  // Budget du design (Risks), demandé par la tâche 2.5. Garde-fou de performance : la détection
  // prend environ 0,15 s, et 0,3 s sans la réduction à 1000 px ; seule une régression d'un ordre
  // de grandeur (par exemple une recherche quadratique sur les composantes) la fait rougir.
  it("détecte la référence en moins de 2 s", async () => {
    const { photo } = referencePhoto();
    const start = performance.now();
    await detectPanel(photo);
    expect(performance.now() - start).toBeLessThan(2000);
  });

  // Photo enregistrée de côté (tournée de 90° dans le sens inverse des aiguilles d'une montre),
  // avec l'orientation EXIF 6 qui la remet droite. Mutation : oublier `rotate()` → les coins
  // sont cherchés sur l'image couchée.
  it("trouve les mêmes coins sur la référence couchée avec l'orientation EXIF 6", async () => {
    const { photo, corners } = referencePhoto();
    const sideways = await sharp(photo)
      .rotate(270)
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 95 })
      .toBuffer();
    const found = await detectPanel(sideways);
    expectCornersNear(found?.corners, corners, 0.01);
  });

  // Photo de biais : la référence tournée de 3° autour de son centre sur fond sombre (sharp agrandit
  // le cadre à la boîte englobante). Les coins attendus sont ceux mesurés à la main, tournés de
  // même. Mutation : relever le bord gauche et droit sur toutes les rangées, y compris celles que
  // le bord haut ou bas penché ne coupe qu'en partie → les coins s'écartent de plus de 0,03.
  it("trouve les coins de la référence tournée de 3°", async () => {
    const { photo, corners } = referencePhoto();
    const { data, info } = await sharp(photo)
      .rotate(3, { background: "#101010" })
      .jpeg({ quality: 92 })
      .toBuffer({ resolveWithObject: true });
    const angle = (3 * Math.PI) / 180;
    const turn = (p: { x: number; y: number }) => {
      const x = p.x * 3000 - 1500;
      const y = p.y * 2250 - 1125;
      return {
        x: (x * Math.cos(angle) - y * Math.sin(angle) + info.width / 2) / info.width,
        y: (x * Math.sin(angle) + y * Math.cos(angle) + info.height / 2) / info.height,
      };
    };
    const expected: Corners = {
      topLeft: turn(corners.topLeft),
      topRight: turn(corners.topRight),
      bottomRight: turn(corners.bottomRight),
      bottomLeft: turn(corners.bottomLeft),
    };
    const found = await detectPanel(data);
    expectCornersNear(found?.corners, expected, 0.01);
  });

  // Le cadre de la photo coupe le bord gauche du panneau : la référence privée de ses 60 premières
  // colonnes, le coin haut gauche tombe 15 px hors de la photo. Ses coins ne sont pas représentables
  // (`Corners` va de 0 à 1) et le tableau touche le bord. Mutation : garder les composantes qui
  // touchent le bord de la photo → le coin est ramené sur le bord et le cadrage accepté.
  it("ne trouve rien quand le cadre de la photo coupe le panneau", async () => {
    const { photo } = referencePhoto();
    const cut = await sharp(photo)
      .extract({ left: 60, top: 0, width: 2940, height: 2250 })
      .jpeg({ quality: 92 })
      .toBuffer();
    expect(await detectPanel(cut)).toBeNull();
  });

  it("ne trouve rien sur une image uniforme gris 200", async () => {
    expect(await detectPanel(await greyWall())).toBeNull();
  });

  // Recherche limitée à une zone (affinage des coins de l'IA, design §4).
  it("trouve les coins de la référence en cherchant dans un quadrilatère qui contient le panneau", async () => {
    const { photo, corners } = referencePhoto();
    const around: Corners = {
      topLeft: { x: 0, y: 0.15 },
      topRight: { x: 1, y: 0.15 },
      bottomRight: { x: 1, y: 0.95 },
      bottomLeft: { x: 0, y: 0.95 },
    };
    const found = await detectPanel(photo, { within: around });
    expectCornersNear(found?.corners, corners, 0.01);
  });

  // Mutation : ignorer `within` → le panneau, hors de la zone, est trouvé quand même.
  it("ne trouve rien en cherchant dans un quadrilatère qui ne contient pas le panneau", async () => {
    const { photo } = referencePhoto();
    const above: Corners = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 0.2 },
      bottomLeft: { x: 0, y: 0.2 },
    };
    expect(await detectPanel(photo, { within: above })).toBeNull();
  });
});
