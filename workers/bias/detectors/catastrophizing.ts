// workers/bias/detectors/catastrophizing.ts — worst-case as certainty (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const DOOM_WORDS = ["disaster", "worst possible", "everything will collapse", "ruined forever", "end of the world", "total catastrophe"];

export function detectCatastrophizing(answer: string, context: { probability?: number } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = DOOM_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted = context.probability !== undefined && context.probability < 0.3;
  return {
    type: "catastrophizing",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.71 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "How likely is that worst case, honestly — and what does the most probable outcome actually look like?",
  };
}
