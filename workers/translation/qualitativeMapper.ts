// workers/translation/qualitativeMapper.ts — Tier2 PANAS/GSE/Schwartz (v3.2 §5.4 883-981)
// Port of EMOTIONAL_SCALE, CONFIDENCE_SCALE, IMPORTANCE_SCALE per spec for ticket [5-02]

export type MappedValue = {
  score: number;
  confidence: number; // 0.85 word, 0.80 phrase
  basis: string;
  method: "qualitative_mapping";
};

const EMOTIONAL_WORDS: Record<number, string[]> = {
  1: ["devastated", "in crisis", "can't function", "broken"],
  2: ["terrible", "awful", "miserable"], // simplified from spec full list
  3: ["miserable", "very unhappy", "struggling", "drained"],
  4: ["unhappy", "down", "tired", "stressed"],
  5: ["okay", "fine", "neutral", "middling"],
  6: ["content", "balanced", "stable"],
  7: ["good", "positive", "hopeful", "energized"],
  8: ["great", "excited", "optimistic"],
  9: ["excellent", "thriving", "fantastic"],
  10: ["ecstatic", "on top of the world", "perfect"],
};

const EMOTIONAL_PHRASES: Record<number, string[]> = {
  3: ["hate my life", "constantly exhausted"],
  2: ["can't go on", "at rock bottom"],
};

const CONFIDENCE_WORDS: Record<number, string[]> = {
  0.5: ["50/50", "coin flip", "toss up"],
  0.6: ["maybe", "possibly"],
  0.7: ["probably", "likely"],
  0.8: ["very likely", "confident"],
  0.9: ["almost certain", "definitely"],
  1.0: ["certain", "guaranteed"],
};

const IMPORTANCE_WORDS: Record<number, string[]> = {
  0.3: ["somewhat important", "matters a bit"],
  0.5: ["important", "matters significantly"],
  0.8: ["essential", "non-negotiable", "critical"],
  1.0: ["absolute", "everything"],
};

function findInDict(text: string, dict: Record<number, string[]>): { score: number; matched: string } | null {
  const lower = text.toLowerCase();
  for (const [scoreStr, words] of Object.entries(dict)) {
    for (const w of words) {
      if (lower.includes(w.toLowerCase())) {
        return { score: parseFloat(scoreStr), matched: w };
      }
    }
  }
  return null;
}

export function mapEmotional(text: string): MappedValue | null {
  const wordHit = findInDict(text, EMOTIONAL_WORDS);
  if (wordHit) {
    return {
      score: wordHit.score,
      confidence: 0.85,
      basis: `PANAS word match: '${wordHit.matched}'`,
      method: "qualitative_mapping",
    };
  }
  const phraseHit = findInDict(text, EMOTIONAL_PHRASES);
  if (phraseHit) {
    return {
      score: phraseHit.score,
      confidence: 0.8,
      basis: `PANAS phrase match: '${phraseHit.matched}'`,
      method: "qualitative_mapping",
    };
  }
  return null;
}

export function mapConfidence(text: string): MappedValue | null {
  const hit = findInDict(text, CONFIDENCE_WORDS);
  if (!hit) return null;
  return {
    score: hit.score,
    confidence: hit.score >= 0.8 ? 0.85 : 0.8,
    basis: `GSE confidence match: '${hit.matched}'`,
    method: "qualitative_mapping",
  };
}

export function mapImportance(text: string): MappedValue | null {
  const hit = findInDict(text, IMPORTANCE_WORDS);
  if (!hit) return null;
  return {
    score: hit.score,
    confidence: 0.85,
    basis: `Schwartz importance match: '${hit.matched}'`,
    method: "qualitative_mapping",
  };
}

export function map(text: string, dimension: string): MappedValue | null {
  if (dimension === "emotional_state" || dimension === "emotional") return mapEmotional(text);
  if (dimension === "confidence") return mapConfidence(text);
  if (dimension === "importance") return mapImportance(text);
  // fallback: try emotional
  return mapEmotional(text) ?? mapConfidence(text) ?? mapImportance(text);
}
