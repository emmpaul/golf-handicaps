import { test as base, expect, type Page } from "@playwright/test";
import { resetData } from "./data";
import { authenticate } from "./session";

type PlayerIds = Record<"Gab" | "Manu" | "Sean", number>;

/**
 * Chaque test part d'une base remise à zéro (joueurs initiaux seulement) et d'une session
 * ouverte. `players` donne les ids des joueurs initiaux.
 */
export const test = base.extend<{ players: PlayerIds }>({
  players: [
    async ({ context, baseURL }, use) => {
      const ids = await resetData();
      await authenticate(context, baseURL);
      await use(ids);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Tag des tests qui attendent la lecture OCR du worker et tournent sur la tranche CI dédiée
 * (`--grep @ocr`) ; les autres tests se répartissent par nombre (`--grep-invert @ocr --shard`).
 * Le tag ne change pas le test. Il ne marque pas tous les tests OCR : seulement assez pour que
 * la tranche dédiée dure autant que les autres (rationalize-ci-runs, décision 6).
 */
export const OCR_SHARD = { tag: "@ocr" };

/** La page ne défile pas de côté : sa largeur reste celle de l'écran. `label` nomme l'état mesuré. */
export async function expectNoHorizontalScroll(page: Page, label?: string) {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(widths.scroll, label).toBeLessThanOrEqual(widths.viewport);
}

/**
 * Rien ne défile de côté sur téléphone, ni la page ni un cadre (design D9, spec `app-shell`
 * « Aucun cadre défilant sur téléphone »). Liste, en plus de la page elle-même :
 * - chaque élément de `main` qui défile ou coupe de côté (`overflow-x` autre que `visible`) et
 *   dont le contenu dépasse sa zone visible de plus d'un pixel (`scrollWidth > clientWidth + 1`) ;
 * - chaque élément de `main` qui sort de l'écran de plus d'un pixel sans être déjà dans un tel
 *   cadre (le cadre est alors listé à sa place).
 * Un élément qui déborde de son parent sans sortir de l'écran ni défiler (une barre pleine
 * largeur en marges négatives) n'est pas listé. Les éléments masqués pour l'œil (texte pour
 * lecteurs d'écran, `clip`, boîte d'un pixel) ne sont pas des zones visibles et sont ignorés.
 */
export async function expectNoSideScroll(page: Page, label?: string) {
  const overflowing = await page.evaluate(() => {
    const isVisuallyHidden = (element: Element) => {
      const style = getComputedStyle(element);
      return (
        element.getBoundingClientRect().width <= 1 ||
        style.clipPath === "inset(50%)" ||
        style.clip === "rect(0px, 0px, 0px, 0px)"
      );
    };
    const isFrame = (element: Element) => getComputedStyle(element).overflowX !== "visible";
    const scrollsSideways = (element: Element) =>
      isFrame(element) && element.scrollWidth > element.clientWidth + 1;
    const insideFrame = (element: Element, main: Element) => {
      for (let node = element.parentElement; node && node !== main; node = node.parentElement) {
        if (isFrame(node)) return true;
      }
      return false;
    };
    const leavesScreen = (element: Element, main: Element) => {
      const box = element.getBoundingClientRect();
      const outside = box.right > innerWidth + 1 || box.left < -1;
      return outside && !insideFrame(element, main);
    };
    const describe = (element: Element) => {
      const hook =
        ["data-testid", "data-slot", "aria-label", "id"]
          .map((name) => element.getAttribute(name))
          .find(Boolean) ?? element.getAttribute("class")?.slice(0, 60);
      const tag = element.tagName.toLowerCase();
      const box = element.getBoundingClientRect();
      return `<${tag}${hook ? ` ${hook}` : ""}>: scrollWidth ${element.scrollWidth} > clientWidth ${element.clientWidth}, right ${Math.round(box.right)} / ${innerWidth}`;
    };
    const main = document.querySelector("main");
    if (!main) return ["no <main> on the page"];
    const root = document.documentElement;
    const found = root.scrollWidth > innerWidth + 1 ? [`page: ${describe(root)}`] : [];
    for (const element of [main, ...main.querySelectorAll("*")]) {
      if (isVisuallyHidden(element)) continue;
      if (scrollsSideways(element) || leavesScreen(element, main)) found.push(describe(element));
    }
    return found;
  });
  expect(overflowing, label).toEqual([]);
}
