import { eq, sum } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiUsage } from "@/db/schema";
import { MAX_CALL_COST } from "./pricing";

/** Mois civil `YYYY-MM` à l'heure de Montréal. */
const monthFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montreal",
  year: "numeric",
  month: "2-digit",
});

function montrealMonth(now: Date): string {
  const part = (type: "year" | "month") =>
    monthFormat.formatToParts(now).find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}`;
}

export type AiCallUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
};

/** Plafond mensuel de dépense IA, cumulé dans `ai_usage` (design, décision 6). */
export class AiBudget {
  private readonly ceilingMicroUsd: number;

  constructor(
    private readonly db: Db,
    monthlyUsd: number,
  ) {
    this.ceilingMicroUsd = Math.round(monthlyUsd * 1_000_000);
  }

  /** Un appel est permis si son pire coût tient encore dans le plafond du mois. */
  canSpend(now: Date): boolean {
    return this.spent(montrealMonth(now)) + MAX_CALL_COST <= this.ceilingMicroUsd;
  }

  record(usage: AiCallUsage, now: Date): void {
    this.db
      .insert(aiUsage)
      .values({ ...usage, month: montrealMonth(now), createdAt: now })
      .run();
  }

  /** Cumul du mois `YYYY-MM`, en micro-dollars. */
  spent(month: string): number {
    const row = this.db
      .select({ total: sum(aiUsage.costMicroUsd) })
      .from(aiUsage)
      .where(eq(aiUsage.month, month))
      .get();
    return Number(row?.total ?? 0);
  }
}
