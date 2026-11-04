// workers/bias/devilsAdvocate.ts — DevilsAdvocateProtocol base (v3.2 §6, ticket [6-01])
import { detectLossAversion, type BiasChallenge as LossChallenge } from "./detectors/lossAversion.js";
import { detectAnchoring } from "./detectors/anchoring.js";
import { detectSocialDesirability } from "./detectors/socialDesirability.js";
import { detectOverconfidence } from "./detectors/overconfidence.js";
import { detectStatusQuo } from "./detectors/statusQuo.js";
import { detectSunkCost } from "./detectors/sunkCost.js";
import { detectConfirmation } from "./detectors/confirmation.js";
import { detectFraming } from "./detectors/framing.js";
import { detectCatastrophizing } from "./detectors/catastrophizing.js";

export type Challenge = { type: string; severity: "LOW"|"MEDIUM"|"HIGH"; confidence: number; evidence: string[]; question: string };

export class DevilsAdvocateProtocol {
  private challengeCount = 0;
  constructor(private opts: { maxChallenges?: number } = {}) {}

  get canChallenge(): boolean {
    return this.challengeCount < (this.opts.maxChallenges ?? 5);
  }

  evaluate_answer(answer: { text: string; context?: Record<string, unknown> }): Challenge | null {
    if (!this.canChallenge) return null;
    const detectors: Array<() => Challenge | null> = [
      () => detectLossAversion(answer.text, answer.context as any),
      () => detectAnchoring(answer.text, answer.context as any),
      () => detectSocialDesirability(answer.text),
      () => detectOverconfidence(answer.text, answer.context as any),
      () => detectStatusQuo(answer.text, answer.context as any),
      () => detectSunkCost(answer.text, answer.context as any),
      () => detectConfirmation(answer.text, answer.context as any),
      () => detectFraming(answer.text, answer.context as any),
      () => detectCatastrophizing(answer.text, answer.context as any),
    ];
    for (const d of detectors) {
      const c = d();
      if (c) {
        this.challengeCount++;
        return c;
      }
    }
    return null;
  }

  reset() { this.challengeCount = 0; }
}
