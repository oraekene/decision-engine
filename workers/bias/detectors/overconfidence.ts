// workers/bias/detectors/overconfidence.ts — certainty beyond evidence (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const CERTAINTY_WORDS = ["no doubt", "impossible to fail", "guaranteed win", "100%", "can't miss", "sure thing"];

export function detectOverconfidence(answer: string, context: { baseRate?: number; confidenceValue?: number } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = CERTAINTY_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted =
    (context.baseRate !== undefined && context.baseRate < 0.5) ||
    (context.confidenceValue !== undefined && context.confidenceValue < 0.7);
  return {
    type: "overconfidence",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.74 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "You sound certain, but what base rate actually supports that confidence? What would have to be true for you to be wrong?",
  };
}
