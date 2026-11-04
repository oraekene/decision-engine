// workers/bias/detectors/statusQuo.ts — defaulting to no-change (v3.2 §6)
import type { BiasChallenge } from "./lossAversion.js";

const INERTIA_WORDS = ["keep things as they are", "rock the boat", "better the devil", "stay put", "change is risky", "leave well alone"];

export function detectStatusQuo(answer: string, context: { switchingBenefit?: number } = {}): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const marker = INERTIA_WORDS.find((w) => lower.includes(w));
  if (!marker) return null;
  const contradicted = context.switchingBenefit !== undefined && context.switchingBenefit > 0;
  return {
    type: "status_quo",
    severity: contradicted ? "MEDIUM" : "LOW",
    confidence: contradicted ? 0.7 : 0.6,
    evidence: [`answer contains "${marker}"`],
    question: "Is staying put actually better, or just more comfortable? If you were choosing fresh today, would you still pick this?",
  };
}
