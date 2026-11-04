// workers/bias/detectors/sunkCost.ts — honoring past spend (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const SUNK_WORDS = ["already invested", "spent so much", "can't walk away now", "too far in", "after all this time", "waste what"];

export function detectSunkCost(answer: string, context: { recoverable?: boolean } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = SUNK_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted = context.recoverable === false;
  return {
    type: "sunk_cost",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.73 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "That money and time are gone either way. Ignoring everything already spent, is continuing still worth it from here?",
  };
}
