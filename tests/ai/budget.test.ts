import { describe, expect, it } from "vitest";
import { AiBudget } from "@/ai/budget";
import { freshTestDb } from "../jobs/helpers";

const testDb = freshTestDb();

/** Usage déjà dépensé, écrit directement en base, sans passer par AiBudget. */
function spentBefore(month: string, costMicroUsd: number) {
  testDb()
    .sqlite.prepare(
      "INSERT INTO ai_usage (created_at, month, model, input_tokens, output_tokens, cost_micro_usd) VALUES (0, ?, 'claude-opus-5-5', 0, 0, ?)",
    )
    .run(month, costMicroUsd);
}

const OCTOBER = new Date("2026-10-17T20:00:00.000Z");

describe("AiBudget.canSpend", () => {
  it("refuse un appel quand 950 000 µ$ sont dépensés en 2026-10 sur un plafond de 1 $", () => {
    spentBefore("2026-10", 950_000);
    expect(new AiBudget(testDb().db, 1).canSpend(OCTOBER)).toBe(false);
  });

  it("autorise un appel en 2026-10 quand les 950 000 µ$ datent de 2026-09", () => {
    spentBefore("2026-09", 950_000);
    expect(new AiBudget(testDb().db, 1).canSpend(OCTOBER)).toBe(true);
  });

  it("autorise un appel dont le pire cas atteint pile le plafond (906 000 + 94 000 µ$)", () => {
    spentBefore("2026-10", 906_000);
    expect(new AiBudget(testDb().db, 1).canSpend(OCTOBER)).toBe(true);
  });

  it("refuse un appel dont le pire cas dépasse le plafond d'un µ$ (906 001 + 94 000 µ$)", () => {
    spentBefore("2026-10", 906_001);
    expect(new AiBudget(testDb().db, 1).canSpend(OCTOBER)).toBe(false);
  });
});

describe("AiBudget.record", () => {
  it("augmente le cumul du mois d'exactement le coût de l'appel", () => {
    spentBefore("2026-10", 950_000);
    const budget = new AiBudget(testDb().db, 1);
    budget.record(
      { model: "claude-opus-5-5", inputTokens: 1700, outputTokens: 900, costMicroUsd: 24_800 },
      OCTOBER,
    );
    expect(budget.spent("2026-10")).toBe(974_800);
  });

  it("compte le 2026-10-31 à 23 h 30 HAE (03 h 30 UTC le 1er novembre) en 2026-10", () => {
    const budget = new AiBudget(testDb().db, 1);
    budget.record(
      { model: "claude-opus-5-5", inputTokens: 1700, outputTokens: 900, costMicroUsd: 24_800 },
      new Date("2026-11-01T03:30:00.000Z"),
    );
    expect([budget.spent("2026-10"), budget.spent("2026-11")]).toEqual([24_800, 0]);
  });
});
