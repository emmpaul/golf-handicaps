import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { AiBudget } from "@/ai/budget";
import { AiCompletionError, type AiUsage } from "@/ai/claude-call";
import type { DraftCompleter } from "@/ai/completer";
import type { CornerLocator } from "@/ai/corner-locator";
import { locatePanel } from "@/jobs/locate-panel";
import type { Corners } from "@/ocr/corners";
import { referencePhoto } from "../ocr/reference";
import {
  cornersDeviation,
  freshTestDb,
  insetReferenceCorners,
  NOW,
  referenceCorners,
  referenceWithTopBar,
} from "./helpers";

const testDb = freshTestDb();

/** Usage d'un appel de cadrage facturé : 1 000 × 4 + 400 × 20 = 12 000 µ$ (spec du budget). */
const USAGE: AiUsage = { model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 400 };

/** Complétion jamais appelée par le cadrage : elle lève si elle l'est. */
const unusedCompleter: DraftCompleter = {
  complete: () => Promise.reject(new Error("complétion appelée pendant le cadrage")),
};

/** Faux cadrage IA : compte les appels et répond par `answer`. */
function fakeLocator(answer: () => Promise<{ corners: Corners | null; usage: AiUsage }>) {
  const calls: Buffer[] = [];
  const locator: CornerLocator = {
    locate(photo) {
      calls.push(photo);
      return answer();
    },
  };
  return { locator, calls };
}

const answers = (corners: Corners | null) => fakeLocator(async () => ({ corners, usage: USAGE }));

function fallback(
  locator: CornerLocator,
  budget = new AiBudget(testDb().db, 1, "America/Montreal"),
) {
  return { completer: unusedCompleter, locator, budget };
}

const usageCosts = () =>
  testDb().sqlite.prepare("SELECT month, cost_micro_usd AS cost FROM ai_usage").all();

/** Rectangle de (x0, y0) à (x1, y1), en fractions de la photo. */
function rectangle(x0: number, y0: number, x1: number, y1: number): Corners {
  return {
    topLeft: { x: x0, y: y0 },
    topRight: { x: x1, y: y0 },
    bottomRight: { x: x1, y: y1 },
    bottomLeft: { x: x0, y: y1 },
  };
}

/** Coins qui encadrent le logo IDRA au-dessus du panneau de la référence. */
const LOGO = rectangle(0, 0.03, 1, 0.235);

describe("locatePanel", () => {
  // Mutation : appeler l'IA avant la détection locale → 1 appel.
  it("garde la détection locale de la référence, sans appel à l'IA", async () => {
    const fake = answers(insetReferenceCorners());
    const found = await locatePanel(referencePhoto().photo, fallback(fake.locator), NOW);
    expect(fake.calls).toHaveLength(0);
    expect(found?.source).toBe("auto");
    expect(cornersDeviation(found?.corners, referenceCorners())).toBeLessThan(0.01);
    expect([found?.panel.width, found?.panel.height]).toEqual([2400, 1224]);
  });

  // Mutation : garder les coins de l'IA sans affinage local → écart de 0,02.
  it("affine dans la zone de l'IA les coins rendus à 0,02 près, en un seul appel", async () => {
    const photo = await referenceWithTopBar();
    const fake = answers(insetReferenceCorners());
    const found = await locatePanel(photo, fallback(fake.locator), NOW);
    expect(fake.calls).toHaveLength(1);
    expect(found?.source).toBe("ai");
    expect(cornersDeviation(found?.corners, referenceCorners())).toBeLessThan(0.01);
  });

  // Coins de la référence élargis de 0,01 (0,005 à gauche en haut). Leur zone agrandie remonte plus
  // haut sur la barre blanche, et l'affinage n'y trouve plus le tableau : les coins de l'IA passent
  // la vérification et sont gardés tels quels. Mutation : rendre `null` quand l'affinage échoue.
  it("garde les coins de l'IA tels quels quand l'affinage échoue et qu'ils sont acceptés", async () => {
    const outset: Corners = {
      topLeft: { x: 0.01, y: 0.21222 },
      topRight: { x: 1, y: 0.22689 },
      bottomRight: { x: 0.97667, y: 0.89222 },
      bottomLeft: { x: 0.02967, y: 0.88556 },
    };
    const found = await locatePanel(
      await referenceWithTopBar(),
      fallback(answers(outset).locator),
      NOW,
    );
    expect([found?.source, found?.corners]).toEqual(["ai", outset]);
  });

  it("enregistre l'usage d'un cadrage réussi : 12 000 µ$ en 2026-10", async () => {
    const photo = await referenceWithTopBar();
    await locatePanel(photo, fallback(answers(insetReferenceCorners()).locator), NOW);
    expect(usageCosts()).toEqual([{ month: "2026-10", cost: 12_000 }]);
  });

  it("sans clé, ne trouve rien quand la détection locale échoue", async () => {
    expect(await locatePanel(await referenceWithTopBar(), null, NOW)).toBeNull();
  });

  // 950 000 + 56 000 > 1 000 000. Mutation : retirer le contrôle du budget → 1 appel.
  it("n'appelle pas l'IA quand le plafond ne permet pas un cadrage", async () => {
    const budget = new AiBudget(testDb().db, 1, "America/Montreal");
    budget.record({ ...USAGE, costMicroUsd: 950_000 }, NOW);
    const fake = answers(insetReferenceCorners());
    const found = await locatePanel(
      await referenceWithTopBar(),
      fallback(fake.locator, budget),
      NOW,
    );
    expect(fake.calls).toHaveLength(0);
    expect(found).toBeNull();
  });

  // 940 000 + 56 000 ≤ 1 000 000, mais pas avec le pire coût d'une complétion (94 000).
  // Mutation : réserver MAX_CALL_COST au lieu de MAX_LOCATE_COST → aucun appel.
  it("appelle l'IA quand le plafond permet encore un cadrage", async () => {
    const budget = new AiBudget(testDb().db, 1, "America/Montreal");
    budget.record({ ...USAGE, costMicroUsd: 940_000 }, NOW);
    const fake = answers(insetReferenceCorners());
    await locatePanel(await referenceWithTopBar(), fallback(fake.locator, budget), NOW);
    expect(fake.calls).toHaveLength(1);
  });

  it("ne trouve rien quand l'API répond par une erreur réseau, sans usage", async () => {
    const fake = fakeLocator(async () => {
      throw new Error("Connection error.");
    });
    const found = await locatePanel(await referenceWithTopBar(), fallback(fake.locator), NOW);
    expect(found).toBeNull();
    expect(usageCosts()).toEqual([]);
  });

  // Mutation : n'enregistrer l'usage que sur un appel réussi → aucune ligne.
  it("compte un JSON hors schéma facturé pour exactement son coût, et ne trouve rien", async () => {
    const fake = fakeLocator(async () => {
      throw new AiCompletionError("invalid", USAGE);
    });
    const found = await locatePanel(await referenceWithTopBar(), fallback(fake.locator), NOW);
    expect(found).toBeNull();
    expect(usageCosts()).toEqual([{ month: "2026-10", cost: 12_000 }]);
  });

  it("ne trouve rien quand l'IA ne voit pas de carte, et compte l'appel", async () => {
    const found = await locatePanel(
      await referenceWithTopBar(),
      fallback(answers(null).locator),
      NOW,
    );
    expect(found).toBeNull();
    expect(usageCosts()).toEqual([{ month: "2026-10", cost: 12_000 }]);
  });

  // Mutation : garder les coins de l'IA sans les vérifier → le logo est accepté.
  it("refuse des coins de l'IA qui encadrent le logo au-dessus du panneau", async () => {
    const found = await locatePanel(
      await referenceWithTopBar(),
      fallback(answers(LOGO).locator),
      NOW,
    );
    expect(found).toBeNull();
  });

  // Coins de l'IA exacts sur un mur gris uniforme : ni l'affinage ni la vérification ne passent.
  it("ne trouve rien sur une photo grise uniforme, même avec des coins de l'IA", async () => {
    const wall = await sharp({
      create: { width: 3000, height: 2250, channels: 3, background: "#c8c8c8" },
    })
      .jpeg()
      .toBuffer();
    expect(await locatePanel(wall, fallback(answers(referenceCorners()).locator), NOW)).toBeNull();
  });
});
