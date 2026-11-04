// workers/bias/detectors/confirmation.ts — seeking agreeable evidence (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const SELECTIVE_WORDS = ["proves me right", "confirms what i", "only look at", "ignore the critics", "cherry", "discount the"];

export function detectConfirmation(answer: string, context: { contradictoryEvidence?: boolean } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = SELECTIVE_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted = context.contradictoryEvidence === true;
  return {
    type: "confirmation",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.72 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "What evidence would change your mind here — and have you actually gone looking for it?",
  };
}
