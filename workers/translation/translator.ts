// workers/translation/translator.ts — NaturalLanguageTranslator orchestrator (v3.2 §5.7, ticket [5-05])
import { extract, confidenceToNumber } from "./directExtractor.js";
import { map as qualitativeMap } from "./qualitativeMapper.js";
import { inferFromText, type InferredValue } from "./contextualInference.js";
import { shouldConfirm } from "./confirmationProtocol.js";

export type TranslatedValue = {
  value: number;
  confidence: number; // 0-1
  method: "direct_extraction" | "qualitative_mapping" | "contextual_inference" | "user_confirmed";
  basis: string;
  original_text: string;
};

export type TranslationLogEntry = {
  timestamp: string;
  input: string;
  dimension: string;
  tier1: ReturnType<typeof extract>;
  tier2: ReturnType<typeof qualitativeMap>;
  tier3?: InferredValue | null;
  final: TranslatedValue | null;
  needsConfirmation: boolean;
  confirmed?: boolean;
};

export class NaturalLanguageTranslator {
  translation_log: TranslationLogEntry[] = [];

  translate(text: string, dimension: string): { value: TranslatedValue | null; needsConfirmation: boolean; log: TranslationLogEntry } {
    const tier1 = extract(text, dimension);
    const tier2 = qualitativeMap(text, dimension);

    let final: TranslatedValue | null = null;
    let confidence = 0;
    let method: TranslatedValue["method"] = "direct_extraction";
    let basis = "";
    let tier3: InferredValue | null = null;

    if (tier1) {
      confidence = confidenceToNumber(tier1.confidence);
      final = {
        value: tier1.value,
        confidence,
        method: "direct_extraction",
        basis: `Tier1 direct extraction from "${tier1.original_text}"`,
        original_text: text,
      };
      method = "direct_extraction";
      basis = final.basis;
    } else if (tier2) {
      confidence = tier2.confidence;
      final = {
        value: tier2.score,
        confidence,
        method: "qualitative_mapping",
        basis: tier2.basis,
        original_text: text,
      };
      method = "qualitative_mapping";
      basis = tier2.basis;
    } else {
      // Tier3 fires only on explicit savings-plus-monthly operands;
      // otherwise the result stays null exactly as before.
      tier3 = inferFromText(text);
      if (tier3) {
        confidence = tier3.confidence;
        final = {
          value: tier3.value,
          confidence,
          method: "contextual_inference",
          basis: tier3.basis,
          original_text: text,
        };
        method = "contextual_inference";
        basis = tier3.basis;
      }
    }

    const discrepancy = tier1 && tier2 ? { tier1Value: tier1.value, tier2Value: tier2.score } : {};
    const confirmCheck = shouldConfirm({
      confidence: final?.confidence ?? 0,
      method: final?.method,
      value: final?.value,
      ...discrepancy,
    });

    const needsConfirmation = confirmCheck.needed;

    // If confirmation needed but we have a value, keep it pending; caller must confirm via UI → 0.95
    const log: TranslationLogEntry = {
      timestamp: new Date().toISOString(),
      input: text,
      dimension,
      tier1,
      tier2,
      tier3,
      final,
      needsConfirmation,
    };
    this.translation_log.push(log);
    return { value: final, needsConfirmation, log };
  }

  confirm(value: TranslatedValue, confirmedValue: number): TranslatedValue {
    return {
      value: confirmedValue,
      confidence: 0.95,
      method: "user_confirmed",
      basis: `User confirmed value ${confirmedValue} (original ${value.value})`,
      original_text: value.original_text,
    };
  }
}
