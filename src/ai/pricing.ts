import {
  AI_MAX_INPUT_TOKENS,
  AI_MAX_TOKENS,
  AI_MODEL,
  LOCATE_MAX_INPUT_TOKENS,
  LOCATE_MAX_TOKENS,
  RATING_MAX_INPUT_TOKENS,
  RATING_MAX_TOKENS,
} from "./model";

/** Tarifs en micro-dollars par token (= $ par million de tokens). */
const PRICES = {
  "claude-opus-5-5": { input: 4, output: 20 },
} as const;

export type PricedModel = keyof typeof PRICES;

/** Usage renvoyé par l'API : tokens réellement facturés, réflexion comprise. */
export type TokenUsage = { input_tokens: number; output_tokens: number };

/** Coût d'un appel en micro-dollars. */
export function callCost(model: PricedModel, usage: TokenUsage): number {
  const price = PRICES[model];
  return usage.input_tokens * price.input + usage.output_tokens * price.output;
}

/** Coût du pire appel, réservé avant chaque appel (design, décision 6). */
export const MAX_CALL_COST = callCost(AI_MODEL, {
  input_tokens: AI_MAX_INPUT_TOKENS,
  output_tokens: AI_MAX_TOKENS,
});

/** Coût du pire appel de cadrage, réservé avant de demander les coins (design, décision 4). */
export const MAX_LOCATE_COST = callCost(AI_MODEL, {
  input_tokens: LOCATE_MAX_INPUT_TOKENS,
  output_tokens: LOCATE_MAX_TOKENS,
});

/** Coût de la pire lecture de carte SGT, réservé avant de lire la rating et le slope. */
export const MAX_RATING_COST = callCost(AI_MODEL, {
  input_tokens: RATING_MAX_INPUT_TOKENS,
  output_tokens: RATING_MAX_TOKENS,
});
