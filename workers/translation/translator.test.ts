import { describe, it, expect } from "vitest";
import { NaturalLanguageTranslator } from "./translator.js";

// Tier pins: Tier1 and Tier2 answers are frozen by the first two tests;
// Tier3 fires only on explicit savings-plus-monthly operands, else null.

describe("translator — tier fallthrough", () => {
  it("Tier1 still answers direct figures", () => {
    const t = new NaturalLanguageTranslator();
    const { value, needsConfirmation } = t.translate("I will save $4,500", "financial");
    expect(value?.method).toBe("direct_extraction");
    expect(value?.value).toBe(4500);
    // Frozen quirk: the extreme-value rule fires on any magnitude >= 9,
    // so large figures always need confirmation. Pinned, not fixed, here.
    expect(needsConfirmation).toBe(true);
  });

  it("Tier2 still answers qualitative language", () => {
    const t = new NaturalLanguageTranslator();
    const { value } = t.translate("I feel great about this", "emotional");
    expect(value?.method).toBe("qualitative_mapping");
  });

  it("Tier3 infers runway from savings plus monthly operands", () => {
    const t = new NaturalLanguageTranslator();
    const { value, needsConfirmation, log } = t.translate(
      "My savings are 18000 and I spend 3000 a month",
      "financial",
    );
    expect(value?.method).toBe("contextual_inference");
    expect(value?.value).toBe(6);
    expect(needsConfirmation).toBe(true);
    expect(log.tier3).toBeTruthy();
  });

  it("Tier3 stays silent without both operand cues", () => {
    const t = new NaturalLanguageTranslator();
    const { value } = t.translate("just some words about the future", "financial");
    expect(value).toBeNull();
  });

  it("Tier3 stays silent on weak cues with stray amounts", () => {
    // Review catch: bare "have"/"month" are not explicit savings-plus-monthly
    // operands, so calendar prose with stray figures must not infer runway.
    const t = new NaturalLanguageTranslator();
    const { value } = t.translate("I have two deadlines and start work next month, budgets 18000 and 3000", "financial");
    expect(value).toBeNull();
  });

  it("Tier3 stays silent on a zero divisor", () => {
    const t = new NaturalLanguageTranslator();
    const { value } = t.translate("My savings are 18000 and I spend 0 a month", "financial");
    expect(value).toBeNull();
  });
});
