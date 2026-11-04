// workers/bias/detectors/framing.ts — deciding on the frame, not the facts (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const LOSS_FRAME_WORDS = ["failure rate", "risk of losing", "chance of loss", "downside risk", "lose everything"];

export function detectFraming(answer: string, context: { equivalentGainFrame?: boolean } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = LOSS_FRAME_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted = context.equivalentGainFrame === true;
  return {
    type: "framing",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.7 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "This is phrased as a loss. Restate the same odds as a gain — does your answer stay the same?",
  };
}
