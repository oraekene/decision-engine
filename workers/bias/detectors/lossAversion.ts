// workers/bias/detectors/lossAversion.ts — v3.2 §6.2 loss aversion (Kahneman & Tversky 1979), ticket [6-02]
export type BiasChallenge = { type: string; severity: "LOW"|"MEDIUM"|"HIGH"; confidence: number; evidence: string[]; question: string };

const LOSS_WORDS = ["devastating", "absolutely cannot risk", "ruin", "catastrophic", "destroy", "cannot afford to lose"];

export function detectLossAversion(answer: string, context: { expectedValue?: number; savings_months?: number }): BiasChallenge | null {
  const lower = answer.toLowerCase();
  const hasLossLang = LOSS_WORDS.some(w => lower.includes(w));
  if (!hasLossLang) return null;
  // If EV >0 or savings buffer exists but language is extreme → flag
  if ((context.expectedValue !== undefined && context.expectedValue > 0) || (context.savings_months !== undefined && context.savings_months >= 3)) {
    return {
      type: "loss_aversion",
      severity: "MEDIUM",
      confidence: 0.75,
      evidence: [`answer contains "${LOSS_WORDS.find(w=>lower.includes(w))}"`, `expectedValue ${context.expectedValue}`, `savings ${context.savings_months}`],
      question: "You describe the loss as devastating, but the numbers suggest you could survive a bad outcome. Is the loss being weighted more heavily than the figures justify?",
    };
  }
  return null;
}
