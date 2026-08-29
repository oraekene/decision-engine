// workers/validation/assumptionElimination.ts — AssumptionEliminationProtocol (v3.2 §7, ticket [7-01])
export type InfoType = "user_fact" | "counterparty_constraint" | "situational_detail";
export type Source = "user_confirmed" | "user_stated" | "inferred" | "user_knows" | "research_framework" | "assumed" | "user_observed" | "stated_by_counterparty";

export type ValidationResult = {
  valid: boolean;
  confidence: number;
  halt_required: boolean;
  needs_confirmation: boolean;
  source_question?: string;
  framework_citation_required?: boolean;
  verification_question?: string;
};

export function validate_information(type: InfoType, _value: string, source: Source): ValidationResult {
  if (type === "user_fact") {
    if (source === "user_confirmed") return { valid: true, confidence: 1.0, halt_required: false, needs_confirmation: false };
    if (source === "user_stated") return { valid: true, confidence: 0.9, halt_required: false, needs_confirmation: true };
    if (source === "inferred") return { valid: false, confidence: 0, halt_required: true, needs_confirmation: true, source_question: "How do you know? Did you observe this directly?" };
  }
  if (type === "counterparty_constraint") {
    if (source === "user_knows") return { valid: true, confidence: 0.8, halt_required: false, needs_confirmation: false, source_question: "How do you know? Did they say directly?" };
    if (source === "research_framework") return { valid: true, confidence: 0.7, halt_required: false, needs_confirmation: false, framework_citation_required: true };
    if (source === "assumed") return { valid: false, confidence: 0, halt_required: true, needs_confirmation: true, source_question: "How do you know this about them?" };
  }
  if (type === "situational_detail") {
    if (source === "user_observed") return { valid: true, confidence: 0.85, halt_required: false, needs_confirmation: false };
    if (source === "stated_by_counterparty") return { valid: true, confidence: 0.7, halt_required: false, needs_confirmation: false, verification_question: "Is this reliable?" };
    if (source === "assumed") return { valid: false, confidence: 0, halt_required: true, needs_confirmation: true, source_question: "Is this from direct experience, research, or assumption?" };
  }
  return { valid: false, confidence: 0, halt_required: true, needs_confirmation: true, source_question: "Can you confirm the source for this?" };
}

const BANNED_PHRASES = ["probably", "i assume", "most likely", "it's obvious", "i think they"];

export function triggersHaltForPhrase(text: string): boolean {
  return BANNED_PHRASES.some(p => text.toLowerCase().includes(p));
}
