// workers/bias/detectors/anchoring.ts — anchoring on first figures (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const ANCHOR_WORDS = ["first offer", "anchor", "stuck on", "initial number", "starting point", "can't move past"];

export function detectAnchoring(answer: string, context: { anchorValue?: number; currentValue?: number } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = ANCHOR_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted =
    context.anchorValue !== undefined &&
    context.currentValue !== undefined &&
    Math.abs(context.currentValue - context.anchorValue) / Math.max(1, Math.abs(context.anchorValue)) < 0.1;
  return {
    type: "anchoring",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.72 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "You keep returning to the first number mentioned. If that figure had never come up, would your answer change?",
  };
}
