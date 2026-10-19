import { eq, sum } from "drizzle-orm";
import type { Db } from "@/db/client";
import { aiUsage } from "@/db/schema";

/** Mois civil `YYYY-MM` de `now` dans le fuseau de `format`. */
function calendarMonth(now: Date, format: Intl.DateTimeFormat): string {
  const part = (type: "year" | "month") =>
    format.formatToParts(now).find((p) => p.type === type)?.value;
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
  private readonly monthFormat: Intl.DateTimeFormat;

  /** `timeZone` : fuseau IANA du mois civil (`AI_BUDGET_TIME_ZONE`, America/Montreal par défaut). */
  constructor(
    private readonly db: Db,
    monthlyUsd: number,
    timeZone: string,
  ) {
    this.ceilingMicroUsd = Math.round(monthlyUsd * 1_000_000);
    this.monthFormat = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    });
  }

  /**
   * Un appel est permis si son pire coût `maxCost` (micro-dollars, `MAX_CALL_COST` ou
   * `MAX_LOCATE_COST`) tient encore dans le plafond du mois.
   */
  canSpend(now: Date, maxCost: number): boolean {
    return this.spent(calendarMonth(now, this.monthFormat)) + maxCost <= this.ceilingMicroUsd;
  }

  record(usage: AiCallUsage, now: Date): void {
    this.db
      .insert(aiUsage)
      .values({ ...usage, month: calendarMonth(now, this.monthFormat), createdAt: now })
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
