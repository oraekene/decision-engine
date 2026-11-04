// workers/bias/detectors/socialDesirability.ts — deciding for applause (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const APPLAUSE_WORDS = ["everyone thinks", "look good", "what will they think", "don't want to seem", "impress", "keep up appearances"];

export function detectSocialDesirability(answer: string): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = APPLAUSE_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  return {
    type: "social_desirability",
    severity: "LOW",
    confidence: 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "Whose approval is shaping this answer? What would you choose if nobody would ever know?",
  };
}
