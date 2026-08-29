// workers/bias/devilsAdvocate.ts — DevilsAdvocateProtocol base (v3.2 §6, ticket [6-01])
import { detectLossAversion, type BiasChallenge as LossChallenge } from "./detectors/lossAversion.js";
// Other detectors are stubs for now, ported incrementally per [6-02]

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
      // TODO: anchoring, social_desirability, overconfidence, status_quo, sunk_cost, confirmation, framing, catastrophizing per ticket [6-02]
      () => null,
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
