import type { AiBudget } from "@/ai/budget";
import { AiCompletionError, type AiUsage } from "@/ai/claude-call";
import type { DraftCompleter } from "@/ai/completer";
import type { CornerLocator } from "@/ai/corner-locator";
import { AI_MODEL } from "@/ai/model";
import { callCost, MAX_LOCATE_COST } from "@/ai/pricing";
import type { Corners } from "@/ocr/corners";
import { acceptCorners, detectPanel } from "@/ocr/detect-panel";
import type { GrayImage } from "@/ocr/image";

/** IA du worker, complétion et cadrage ; absente (`null`) sans `ANTHROPIC_API_KEY`. */
export type AiFallback = { completer: DraftCompleter; locator: CornerLocator; budget: AiBudget };

/** Cadrage accepté, le panneau redressé qui sera lu, et qui l'a trouvé. */
export type LocatedPanel = { corners: Corners; panel: GrayImage; source: "auto" | "ai" };

/** Un appel facturé, même sans réponse exploitable, entre dans le cumul du mois. */
export function recordUsage(budget: AiBudget, usage: AiUsage, now: Date) {
  const costMicroUsd = callCost(AI_MODEL, {
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
  });
  budget.record({ ...usage, costMicroUsd }, now);
}

/** Les coins de l'IA sont approximatifs : on cherche dans leur quadrilatère agrandi de 10 %. */
const AI_ZONE_GROWTH = 1.1;

function grown(corners: Corners): Corners {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  const cx = points.reduce((sum, p) => sum + p.x, 0) / 4;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / 4;
  const away = (p: { x: number; y: number }) => ({
    x: cx + (p.x - cx) * AI_ZONE_GROWTH,
    y: cy + (p.y - cy) * AI_ZONE_GROWTH,
  });
  return {
    topLeft: away(corners.topLeft),
    topRight: away(corners.topRight),
    bottomRight: away(corners.bottomRight),
    bottomLeft: away(corners.bottomLeft),
  };
}

/** Coins rendus par l'IA, `null` si elle ne voit pas de carte ou si l'appel échoue. */
async function askCorners(photo: Buffer, ai: AiFallback, now: Date): Promise<Corners | null> {
  try {
    const { corners, usage } = await ai.locator.locate(photo);
    recordUsage(ai.budget, usage, now);
    return corners;
  } catch (error) {
    if (error instanceof AiCompletionError) recordUsage(ai.budget, error.usage, now);
    return null;
  }
}

/**
 * Cadrage d'un import sans coins (design, décision 4) : détection locale, puis une seule
 * demande à Claude si elle échoue, qu'une clé est configurée et que le budget le permet. Les
 * coins de l'IA sont affinés localement dans leur zone, sinon vérifiés tels quels. `null`
 * quand aucun cadrage n'est accepté : « Panneau introuvable sur la photo ».
 */
export async function locatePanel(
  photo: Buffer,
  ai: AiFallback | null,
  now: Date,
): Promise<LocatedPanel | null> {
  const local = await detectPanel(photo);
  if (local) return { corners: local.corners, panel: local.panel, source: "auto" };
  if (!ai?.budget.canSpend(now, MAX_LOCATE_COST)) return null;
  const corners = await askCorners(photo, ai, now);
  if (!corners) return null;
  const refined = await detectPanel(photo, { within: grown(corners) });
  if (refined) return { corners: refined.corners, panel: refined.panel, source: "ai" };
  const panel = await acceptCorners(photo, corners);
  return panel ? { corners, panel, source: "ai" } : null;
}
