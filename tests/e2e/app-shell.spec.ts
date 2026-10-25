import { expect, type Locator, type Page, test } from "@playwright/test";
import sharp from "sharp";
import {
  referenceRound,
  seedFailedImport,
  seedProposedBethpageRed,
  seedReadyImport,
  seedRound,
  setImportCreatedAt,
} from "./data";
import { saveButton } from "./editor";
import { test as appTest, expectNoHorizontalScroll } from "./fixtures";

// Fichiers d'installation : lus sans session, comme les lit Safari depuis l'écran de connexion.
test.describe("installation sur l'écran d'accueil, sans session", () => {
  test("le manifest décrit une app plein écran nommée « Golf »", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const manifest = await response.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.short_name).toBe("Golf");
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
      "192x192",
      "512x512",
    ]);
  });

  for (const [path, side] of [
    ["/icon/192", 192],
    ["/icon/512", 512],
    ["/apple-icon", 180],
  ] as const) {
    test(`${path} est une image PNG de ${side} × ${side} px`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
      const { width, height, format } = await sharp(await response.body()).metadata();
      expect({ width, height, format }).toEqual({ width: side, height: side, format: "png" });
    });
  }

  test("la page de connexion annonce le plein écran, le manifest et l'icône iOS", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover/,
    );
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(
      page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]'),
    ).toHaveAttribute("content", "#F4F7FB");
  });

  // Spec `visual-theme`, « Couleurs du manifest ». Mutation : `theme_color` remis à `#ffffff` dans
  // `manifest.ts` → rouge.
  test("le manifest prend le fond clair de la palette", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect({ theme: manifest.theme_color, background: manifest.background_color }).toEqual({
      theme: "#F4F7FB",
      background: "#F4F7FB",
    });
  });

  // Spec `visual-theme`, « Même marque sur l'écran d'accueil ». Mutation : fond d'`AppGlyph`
  // remis au vert Fairway `#1F5E3B` → rouge.
  test("/icon/192 répond 200 sur le fond d'encre de la palette", async ({ request }) => {
    const response = await request.get("/icon/192", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    // Coin haut gauche : hors du dessin, c'est le fond.
    const { data } = await sharp(await response.body())
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([...data]).toEqual([0x0f, 0x1d, 0x3e]);
  });
});

/** Gab et Manu sur 6 rounds de la carte de référence, du 1er au 6 octobre 2026. */
function seedSixRounds(players: { Gab: number; Manu: number }) {
  for (const day of [1, 2, 3, 4, 5, 6]) {
    seedRound(referenceRound(players, { playedOn: `2026-10-0${day}` }));
  }
}

/** Hauteur minimale d'une cible tactile sous 768 px (spec « Cibles tactiles »). */
const MIN_TOUCH_TARGET = 44;

const heightOf = async (locator: Locator) => (await locator.boundingBox())?.height ?? 0;

/**
 * Contrôles visibles de `main` dont la zone de toucher fait moins de 44 px de haut, et nombre
 * de contrôles mesurés. Les cases de la grille des scores (dans la `table`) sont exclues par
 * la spec. Un champ masqué (`sr-only`) se touche par son libellé : c'est lui qui est mesuré.
 */
function smallControls(page: Page) {
  return page.getByRole("main").evaluate((main, min) => {
    const controls = [
      ...main.querySelectorAll<HTMLElement>(
        "button, input:not([type=checkbox]):not([type=radio]), select, a",
      ),
    ].filter((control) => !control.closest("table") && control.checkVisibility());
    const touchHeight = (control: HTMLElement) => {
      const { height } = control.getBoundingClientRect();
      const label = control instanceof HTMLInputElement ? control.labels?.[0] : undefined;
      return height <= 1 && label ? label.getBoundingClientRect().height : height;
    };
    return {
      count: controls.length,
      small: controls
        .filter((control) => touchHeight(control) < min)
        .map(
          (control) =>
            `${control.tagName} « ${control.getAttribute("aria-label") || control.textContent?.trim() || control.getAttribute("name") || control.id} » ${touchHeight(control)} px`,
        ),
    };
  }, MIN_TOUCH_TARGET);
}

appTest.describe("cibles tactiles sur iPhone", () => {
  appTest.skip(({ isMobile }) => !isMobile, "Tailles de téléphone : projet webkit-iphone");

  appTest(
    "la liste « Joueur de la ligne 1 » fait 44 px de haut et un texte de 16 px",
    async ({ page }) => {
      await page.goto(`/imports/${seedReadyImport()}`);
      const select = page.getByLabel("Joueur de la ligne 1");
      expect(await heightOf(select)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(await select.evaluate((element) => getComputedStyle(element).fontSize)).toBe("16px");
    },
  );

  appTest(
    "sur Joueurs, le bouton « Ajouter » et son champ font 44 px de haut",
    async ({ page }) => {
      await page.goto("/players");
      expect(
        await heightOf(page.getByRole("button", { name: "Ajouter", exact: true })),
      ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      expect(await heightOf(page.getByLabel("Nouveau joueur"))).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET,
      );
    },
  );

  appTest(
    "à 390 px, les listes du mois et de l'année du calendrier font 44 px et un texte de 16 px",
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/rounds/new");
      await page.getByLabel("Date").click();
      await expect(page.getByRole("grid")).toBeVisible();
      await settled(page.locator('[data-slot="popover-content"]'));
      const measured: Record<string, { fontSize: string; tall: boolean }> = {};
      for (const name of ["Choisir le mois", "Choisir l'année"]) {
        // La liste native, transparente, couvre tout son libellé : sa boîte est la zone de toucher.
        const select = page.getByRole("combobox", { name });
        measured[name] = {
          fontSize: await select.evaluate((element) => getComputedStyle(element).fontSize),
          tall: (await heightOf(select)) >= MIN_TOUCH_TARGET,
        };
      }
      expect(measured).toEqual({
        "Choisir le mois": { fontSize: "16px", tall: true },
        "Choisir l'année": { fontSize: "16px", tall: true },
      });
    },
  );

  appTest(
    "le lien « Vérifier » d'un import prêt a une zone de toucher de 44 px",
    async ({ page }) => {
      seedReadyImport();
      await page.goto("/import");
      expect(await heightOf(page.getByRole("link", { name: "Vérifier" }))).toBeGreaterThanOrEqual(
        MIN_TOUCH_TARGET,
      );
    },
  );

  // Scénario « Case de score sur iPhone ». Mutation : `h-9` (36 px) ou `md:text-sm` appliqué
  // sous 768 px sur les cases de la grille de téléphone → rouge.
  appTest(
    "à 390 px, la case du score du trou 1 de la ligne 1 fait 44 px de haut et un texte de 16 px",
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/imports/${seedReadyImport()}`);
      const score = page.getByRole("textbox", { name: "Ligne 1 trou 1", exact: true });
      expect({
        tall: (await heightOf(score)) >= MIN_TOUCH_TARGET,
        fontSize: await score.evaluate((element) => getComputedStyle(element).fontSize),
      }).toEqual({ tall: true, fontSize: "16px" });
    },
  );

  appTest(
    "aucun contrôle visible d'Importer, Joueurs, Coups, Parcours et de la correction ne fait moins de 44 px",
    async ({ page, players }) => {
      const readyId = seedReadyImport();
      seedFailedImport();
      seedProposedBethpageRed();
      seedRound(referenceRound(players));
      const pages: Record<string, () => Promise<unknown>> = {
        "/import": () => expect(page.getByRole("link", { name: "Vérifier" })).toBeVisible(),
        "/players": () => expect(page.getByLabel("Nouveau joueur")).toBeVisible(),
        "/strokes": () => expect(page.getByLabel("Parcours", { exact: true })).toBeVisible(),
        "/courses": () => expect(page.getByRole("button", { name: /^Confirmer/ })).toBeVisible(),
        [`/imports/${readyId}`]: () =>
          expect(page.getByRole("img", { name: "Carte importée" })).toBeVisible(),
      };
      const small: Record<string, string[]> = {};
      for (const [path, ready] of Object.entries(pages)) {
        await page.goto(path);
        await ready();
        const measured = await smallControls(page);
        expect(measured.count, path).toBeGreaterThan(0);
        small[path] = measured.small;
      }
      expect(small).toEqual({
        "/import": [],
        "/players": [],
        "/strokes": [],
        "/courses": [],
        [`/imports/${readyId}`]: [],
      });
    },
  );
});

appTest.describe("contrôles sur ordinateur", () => {
  appTest.skip(({ isMobile }) => isMobile, "Tailles d'ordinateur : projet chromium");
  appTest.use({ viewport: { width: 1440, height: 900 } });

  appTest("à 1440 px, le bouton « Ajouter » de Joueurs garde 32 px de haut", async ({ page }) => {
    await page.goto("/players");
    expect(await heightOf(page.getByRole("button", { name: "Ajouter", exact: true }))).toBe(32);
  });
});

/** Les cinq sections, dans l'ordre de la navigation (spec « Navigation entre sections »). */
const SECTIONS = ["Importer", "Rounds", "Handicaps", "Coups", "Joueurs"];

const sectionsBar = (page: Page) => page.getByRole("navigation", { name: "Sections" });

/** Bord haut de la barre « Sections », en px dans la fenêtre. */
async function tabBarTop(page: Page) {
  const box = await sectionsBar(page).boundingBox();
  if (!box) throw new Error("Barre « Sections » absente");
  return box.y;
}

/**
 * Libellés des liens visibles des navigations qui portent `aria-current="page"`. Une
 * navigation masquée en CSS (`display: none`) n'a plus de rôle : ses liens ne comptent pas.
 */
const currentLinks = (page: Page) =>
  page
    .getByRole("navigation")
    .getByRole("link")
    .evaluateAll((links) =>
      links
        .filter((link) => link.getAttribute("aria-current") === "page")
        .map((link) => link.textContent?.trim()),
    );

appTest.describe("navigation sur iPhone", () => {
  appTest.skip(({ isMobile }) => !isMobile, "Barre du bas : projet webkit-iphone");

  appTest(
    "à 320 px, les cinq sections tiennent dans la barre du bas, en cibles de 44 × 44 px",
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto("/import");
      const bar = sectionsBar(page);
      const sizes: Record<string, boolean> = {};
      for (const name of SECTIONS) {
        const link = bar.getByRole("link", { name });
        await expect(link).toBeInViewport({ ratio: 1 });
        const box = await link.boundingBox();
        sizes[name] =
          (box?.width ?? 0) >= MIN_TOUCH_TARGET && (box?.height ?? 0) >= MIN_TOUCH_TARGET;
      }
      expect(sizes).toEqual({
        Importer: true,
        Rounds: true,
        Handicaps: true,
        Coups: true,
        Joueurs: true,
      });
    },
  );

  appTest(
    "en bas de Handicaps, le dernier élément de la page finit au-dessus de la barre",
    async ({ page, players }) => {
      // Gab et Manu à 6 rounds : courbe et table chacun, la page dépasse l'écran.
      seedSixRounds(players);
      await page.goto("/handicaps");
      await expect(page.getByRole("table", { name: "Différentiels de Gab" })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastBottom = await page
        .getByRole("main")
        .evaluate(
          (main) =>
            main.lastElementChild?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        );
      expect(lastBottom).toBeLessThanOrEqual(await tabBarTop(page));
    },
  );

  appTest(
    "sur la correction, la barre « Enregistrer » finit au ras du haut des onglets",
    async ({ page }) => {
      await page.goto(`/imports/${seedReadyImport()}`);
      const bar = saveButton(page).locator("xpath=..");
      const save = await bar.boundingBox();
      if (!save) throw new Error("Barre « Enregistrer » absente");
      expect(Math.round(save.y + save.height)).toBe(Math.round(await tabBarTop(page)));
      const safeBottom = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom").trim(),
      );
      expect(safeBottom).not.toBe("");
    },
  );
});

appTest.describe("section courante", () => {
  appTest("sur la page d'un round, seul « Rounds » est marqué", async ({ page, players }) => {
    await page.goto(`/rounds/${seedRound(referenceRound(players))}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bethpage Black");
    expect(await currentLinks(page)).toEqual(["Rounds"]);
  });

  // Spec `course-rating`, « Navigation ». Mutation : `/courses` absent de `SECTION_PREFIXES`.
  appTest("sur la page Parcours, seul « Rounds » est marqué", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parcours");
    expect(await currentLinks(page)).toEqual(["Rounds"]);
  });

  appTest("sur la correction d'un import, seul « Importer » est marqué", async ({ page }) => {
    await page.goto(`/imports/${seedReadyImport()}`);
    await expect(page.getByLabel("Parcours", { exact: true })).toBeVisible();
    expect(await currentLinks(page)).toEqual(["Importer"]);
  });

  appTest("sur l'accueil, aucun lien n'est marqué", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Handicaps golf");
    expect(await currentLinks(page)).toEqual([]);
  });
});

appTest.describe("navigation sur ordinateur", () => {
  appTest.skip(({ isMobile }) => isMobile, "Navigation du haut : projet chromium");

  appTest("à 1024 px, pas de barre du bas et les cinq sections en haut", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/import");
    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
    await expect(sectionsBar(page)).toBeHidden();
    const top = page.getByRole("navigation", { name: "Navigation principale" });
    for (const name of SECTIONS) await expect(top.getByRole("link", { name })).toBeVisible();
  });

  appTest("à 1440 px, la barre « Enregistrer » a la largeur du contenu", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/imports/${seedReadyImport()}`);
    const bar = saveButton(page).locator("xpath=..");
    // 1 280 px de `main` (max-w-7xl) moins ses deux marges de 16 px.
    expect(Math.round((await bar.boundingBox())?.width ?? 0)).toBe(1248);
  });
});

appTest.describe("passe ordinateur", () => {
  appTest.skip(({ isMobile }) => isMobile, "Largeurs d'ordinateur : projet chromium");
  appTest.use({ viewport: { width: 1440, height: 900 } });

  appTest("le classement net d'un round mesure au plus 672 px", async ({ page, players }) => {
    await page.goto(`/rounds/${seedRound(referenceRound(players))}`);
    const box = await page.getByRole("table", { name: "Classement net" }).boundingBox();
    // `max-w-2xl` : 42 rem.
    expect(box?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(672);
  });

  appTest(
    "sur Handicaps, la courbe de Gab a la hauteur de sa table, à 8 px près",
    async ({ page, players }) => {
      // 6 rounds : la table dépasse les 192 px de hauteur minimale de la courbe.
      seedSixRounds(players);
      await page.goto("/handicaps");
      const curve = await heightOf(page.getByRole("figure", { name: "Courbe de l'index de Gab" }));
      const table = await heightOf(page.getByRole("table", { name: "Différentiels de Gab" }));
      expect(Math.abs(curve - table), `courbe ${curve} px, table ${table} px`).toBeLessThanOrEqual(
        8,
      );
    },
  );

  appTest(
    "la date d'un import s'écrit comme les dates de jeu, suivie de l'heure",
    async ({ page }) => {
      // Heure locale : le test, le serveur et le navigateur partagent le fuseau de la machine.
      setImportCreatedAt(seedReadyImport(), new Date(2026, 9, 17, 19, 32));
      await page.goto("/import");
      await expect(page.getByRole("listitem").locator("time")).toHaveText("17 octobre 2026, 19:32");
    },
  );
});

/** Attend la fin de l'animation d'ouverture d'une fenêtre, qui part d'une échelle de 95 %. */
const settled = (popup: Locator) =>
  popup.evaluate((element) => Promise.all(element.getAnimations().map(({ finished }) => finished)));

/** Handicaps à 390 px, Gab seul sur 9 rounds : ses 3 meilleurs différentiels comptent. */
async function openHandicapsOfGabAlone(page: Page, players: { Gab: number; Manu: number }) {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const day of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const round = referenceRound(players, { playedOn: `2026-10-0${day}` });
    seedRound({ ...round, players: [round.players[0]] });
  }
  await page.goto("/handicaps");
}

/**
 * Attend `locator` visible à `ratio` dans la fenêtre. La page défile d'abord verticalement
 * jusqu'à lui (la marque, sur sa propre ligne, allonge les rangées au-delà de 844 px) ; le
 * cadre défilant de la table, lui, reste en place : le faire défiler masquerait la coupe.
 */
async function expectInViewportOnceScrolledTo(locator: Locator, ratio = 1) {
  await locator.evaluate((element) =>
    window.scrollBy(0, element.getBoundingClientRect().top - window.innerHeight / 2),
  );
  await expect(locator).toBeInViewport({ ratio });
}

appTest.describe("rien de coupé sur téléphone", () => {
  appTest.skip(({ isMobile }) => !isMobile, "Largeurs de téléphone : projet webkit-iphone");

  for (const [width, height] of [
    [320, 640],
    [390, 844],
  ] as const) {
    appTest(
      `à ${width} px, aucune page, ni le calendrier ni le dialogue, n'élargit la page`,
      async ({ page, players }) => {
        await page.setViewportSize({ width, height });
        // Une proposition à confirmer : la carte la plus chargée de la page Parcours.
        seedProposedBethpageRed();
        const roundId = seedRound(referenceRound(players));
        const importId = seedReadyImport();
        seedFailedImport();
        const openCalendar = async () => {
          await page.getByLabel("Date").click();
          await expect(page.getByRole("grid")).toBeVisible();
          await settled(page.locator('[data-slot="popover-content"]'));
        };
        const openDeleteDialog = async () => {
          await page.getByRole("button", { name: "Supprimer" }).click();
          await settled(page.getByRole("alertdialog", { name: "Supprimer ce round ?" }));
        };
        const pages: [string, (() => Promise<void>)?][] = [
          ["/"],
          ["/import"],
          [`/imports/${importId}`, openCalendar],
          ["/rounds"],
          [`/rounds/${roundId}`, openDeleteDialog],
          [`/rounds/${roundId}/edit`],
          ["/rounds/new", openCalendar],
          ["/players"],
          ["/handicaps"],
          ["/strokes"],
          ["/courses"],
        ];
        for (const [path, open] of pages) {
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
          await expectNoHorizontalScroll(page, path);
          if (open) {
            await open();
            await expectNoHorizontalScroll(page, `${path}, fenêtre ouverte`);
          }
        }
      },
    );
  }

  appTest(
    "à 390 px, chaque marque « Compte » de Handicaps est entièrement visible",
    async ({ page, players }) => {
      await openHandicapsOfGabAlone(page, players);
      const marks = page.getByText("Compte", { exact: true }).filter({ visible: true });
      await expect(marks).toHaveCount(3);
      for (const mark of await marks.all()) await expectInViewportOnceScrolledTo(mark);
    },
  );

  appTest(
    "à 390 px, la colonne « Index après » de Handicaps est entièrement visible",
    async ({ page, players }) => {
      // La marque « Compte » ne doit pas élargir la colonne de la date.
      await openHandicapsOfGabAlone(page, players);
      // WebKit répartit la table `w-full` en largeurs fractionnaires : la dernière colonne dépasse
      // son cadre de 0,02 px. 99 % tolère cet arrondi ; coupée, la colonne tombait à 90 %.
      const ratio = 0.99;
      const table = page.getByRole("table", { name: "Différentiels de Gab" });
      await expectInViewportOnceScrolledTo(
        table.getByRole("columnheader", { name: "Index après" }),
        ratio,
      );
      const rows = table.locator("tbody").getByRole("row");
      await expect(rows).toHaveCount(9);
      for (const row of await rows.all()) {
        await expectInViewportOnceScrolledTo(row.getByRole("cell").nth(2), ratio);
      }
    },
  );

  appTest(
    "sur Importer, « Choisir une photo » fait 44 px et le champ « Photo de la carte » prend le focus",
    async ({ page }) => {
      await page.goto("/import");
      const button = page.getByText("Choisir une photo", { exact: true });
      await expect(button).toBeVisible();
      expect(await heightOf(button)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
      const file = page.getByLabel("Photo de la carte");
      await file.focus();
      await expect(file).toBeFocused();
    },
  );
});

// Spec `visual-theme`, « Focus visible au clavier » : le contour paraît dans la même image, sans
// transition. Mutation : `transition-all` remis sur le lien d'onglet (`app-nav.tsx`) → la durée
// de transition du contour passe à 0.15s, rouge.
appTest(
  "au clavier, l'onglet « Handicaps » montre son contour de focus sans transition",
  async ({ page, isMobile, browserName }) => {
    await page.goto("/rounds");
    // WebKit, comme Safari, ne passe sur les liens qu'avec Option + Tab.
    const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
    const nav = isMobile
      ? sectionsBar(page)
      : page.getByRole("navigation", { name: "Navigation principale" });
    const tab = nav.getByRole("link", { name: "Handicaps" });
    await expect(tab).toBeVisible();
    for (let presses = 0; presses < 30; presses++) {
      if (await tab.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press(tabKey);
    }
    await expect(tab).toBeFocused();
    const outline = await tab.evaluate((element) => {
      const style = getComputedStyle(element);
      const properties = style.transitionProperty.split(",").map((value) => value.trim());
      const durations = style.transitionDuration.split(",").map((value) => value.trim());
      // Durée qui s'applique à la couleur du contour : celle de `all`, `outline` ou `outline-color`.
      const index = properties.findIndex((name) =>
        ["all", "outline", "outline-color"].includes(name),
      );
      return {
        style: style.outlineStyle,
        duration: index === -1 ? "0s" : durations[index % durations.length],
      };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.duration).toBe("0s");
  },
);

appTest("Fairway brand and current tab pill", async ({ page, players }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/rounds/${seedRound(referenceRound(players))}`);
  const brand = page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("link", { name: "Golf", exact: true });
  await expect(brand).toBeVisible();
  await expect(brand).not.toContainText("⛳");
  // Mutation: unconditional bg-primary/12 makes every tab show a pill.
  const links = sectionsBar(page).getByRole("link");
  for (const link of await links.all()) {
    const pill = link.locator('[data-slot="tab-pill"]');
    await expect(pill).toBeVisible();
    const background = await pill.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background === "rgba(0, 0, 0, 0)").toBe(
      (await link.getAttribute("aria-current")) !== "page",
    );
  }
});

/** Opacité d'une couleur calculée : `rgba(r, g, b, a)`, `oklch(l c h / a)`… ; 1 sans alpha écrit. */
function alphaOf(color: string) {
  const slash = color.match(/\/\s*([\d.]+)\s*\)$/);
  if (slash) return Number(slash[1]);
  const rgba = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/);
  return rgba ? Number(rgba[1]) : 1;
}

// Spec `app-shell`, « En-tête opaque » (design D10). Mutation : fond `bg-background/80` sur le
// `header` de `app-nav.tsx` → alpha 0,8 et couleur différente de `html` / `body`, rouge.
for (const colorScheme of ["light", "dark"] as const) {
  appTest(
    `à 390 px en ${colorScheme === "light" ? "clair" : "sombre"}, après défilement de Rounds, l'en-tête reste collé, opaque, de la couleur de html et body`,
    async ({ page, players }) => {
      // Douze rounds : la liste dépasse les 844 px de l'écran, la page défile.
      for (const day of [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]) {
        seedRound(referenceRound(players, { playedOn: `2026-10-${day}` }));
      }
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/rounds");
      await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(
        12,
      );
      // En bas de page : plus de 100 px défilés, un en-tête non collé serait hors de l'écran.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      const header = page.locator("header");
      expect((await header.boundingBox())?.y).toBe(0);
      const measured = await header.evaluate((element) => {
        const background = (node: Element) => getComputedStyle(node).backgroundColor;
        const brand = element.querySelector("a")?.getBoundingClientRect().top ?? 0;
        return {
          header: background(element),
          html: background(document.documentElement),
          body: background(document.body),
          backdrop: getComputedStyle(element).backdropFilter,
          brandTop: brand - element.getBoundingClientRect().top,
        };
      });
      expect(alphaOf(measured.header)).toBe(1);
      expect(measured.backdrop).toBe("none");
      expect({ html: measured.html, body: measured.body }).toEqual({
        html: measured.header,
        body: measured.header,
      });
      // Zone sûre nulle hors plein écran : la marque commence au moins 8 px sous le haut.
      expect(measured.brandTop).toBeGreaterThanOrEqual(8);
    },
  );
}
