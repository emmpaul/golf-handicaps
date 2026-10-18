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
