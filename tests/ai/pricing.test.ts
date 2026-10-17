import { describe, expect, it } from "vitest";
import { callCost, MAX_CALL_COST } from "@/ai/pricing";

describe("callCost", () => {
  it("compte 4 µ$ par token d'entrée et 20 µ$ par token de sortie sur claude-opus-5-5", () => {
    expect(callCost("claude-opus-5-5", { input_tokens: 1700, output_tokens: 900 })).toBe(24_800);
  });
});

describe("MAX_CALL_COST", () => {
  it("vaut le pire cas : 2 000 tokens d'entrée et 4 000 de sortie, soit 0,088 $", () => {
    expect(MAX_CALL_COST).toBe(88_000);
  });
});
