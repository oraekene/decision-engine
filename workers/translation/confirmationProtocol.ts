// workers/translation/confirmationProtocol.ts — Tier4 (v3.2 §5.6, ticket [5-04])
// Triggers: confidence_below_0.5, tier1_tier2_discrepancy, extreme ≤2/≥9, contradicts_prior, contextual_inference+assumptions

export type ConfirmationTrigger = "low_confidence" | "discrepancy" | "extreme_value" | "contradicts_prior" | "contextual_assumption";

export function shouldConfirm(opts: {
  confidence: number;
  method?: string;
  value?: number;
  tier1Value?: number | null;
  tier2Value?: number | null;
  priorValues?: number[];
}): { needed: boolean; trigger?: ConfirmationTrigger; reason?: string } {
  if (opts.confidence < 0.5) {
    return { needed: true, trigger: "low_confidence", reason: `confidence ${opts.confidence} <0.50` };
  }
  if (opts.tier1Value !== null && opts.tier1Value !== undefined && opts.tier2Value !== null && opts.tier2Value !== undefined) {
    const diff = Math.abs(opts.tier1Value - opts.tier2Value);
    if (diff >= 1.0) { // discrepancy threshold (e.g., 3 vs 4)
      return { needed: true, trigger: "discrepancy", reason: `Tier1 ${opts.tier1Value} vs Tier2 ${opts.tier2Value} diff ${diff}` };
    }
  }
  if (opts.value !== undefined) {
    // emotional scale 1-10 extreme
    if (opts.value <= 2 || opts.value >= 9) {
      return { needed: true, trigger: "extreme_value", reason: `extreme value ${opts.value}` };
    }
    if (opts.priorValues && opts.priorValues.length > 0) {
      const contradicts = opts.priorValues.some((p) => Math.abs(p - opts.value!) > 3);
      if (contradicts) {
        return { needed: true, trigger: "contradicts_prior", reason: `contradicts prior ${opts.priorValues.join(",")}` };
      }
    }
  }
  if (opts.method === "contextual_inference") {
    return { needed: true, trigger: "contextual_assumption", reason: `contextual inference requires confirmation` };
  }
  return { needed: false };
}
