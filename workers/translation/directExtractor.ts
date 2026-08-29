// workers/translation/directExtractor.ts — Tier1 DirectNumericExtractor (v3.2 §5.3 769-879, PATTERNS verbatim)
// Pure regex, no LLM, Worker TS. Must match spec EXTRACTION_PATTERNS + FUZZY_MODIFIERS exactly for ticket [5-01].

export type ExtractedValue = {
  value: number;
  tolerance: number;
  confidence: "HIGH" | "MEDIUM";
  source: "direct_extraction";
  original_text: string;
};

const EXTRACTION_PATTERNS: Record<string, RegExp[]> = {
  financial: [
    /(\d+\.?\d*)\s*(k|thousand)\b/gi, // 5k, 5 thousand
    /\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, // $4,500
    /(\d+\.?\d*)\s*(percent|%)/gi,
    /(\d+)\s*(months|mos)\b/gi,
    /(\d+)\s*(years|yrs)\b/gi,
  ],
  emotional: [
    /(\d+)\s*out of\s*10/gi,
    /(\d+)\s*\/\s*10/gi,
    /(\d+)\s*on a scale of/gi,
  ],
  temporal: [
    /(\d+)\s*hours?\b/gi,
    /(\d+)\s*weeks?\b/gi,
    /(\d+)\s*days?\b/gi,
    /(\d+)\s*months?\b/gi,
  ],
};

const FUZZY_MODIFIERS: Record<string, { tolerance: number; confidence: "HIGH" | "MEDIUM" }> = {
  "about": { tolerance: 0.10, confidence: "HIGH" },
  "around": { tolerance: 0.10, confidence: "HIGH" },
  "roughly": { tolerance: 0.15, confidence: "HIGH" },
  "maybe": { tolerance: 0.20, confidence: "MEDIUM" },
  "probably": { tolerance: 0.15, confidence: "MEDIUM" },
  "at least": { tolerance: 0, confidence: "HIGH" }, // min
  "up to": { tolerance: 0, confidence: "HIGH" }, // max
};

function detectFuzzy(text: string): { modifier?: string; tolerance: number; confidence: "HIGH" | "MEDIUM" } {
  const lower = text.toLowerCase();
  for (const [mod, { tolerance, confidence }] of Object.entries(FUZZY_MODIFIERS)) {
    if (lower.includes(mod)) return { modifier: mod, tolerance, confidence };
  }
  return { tolerance: 0, confidence: "HIGH" };
}

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  const lower = cleaned.toLowerCase();
  if (lower.endsWith("k") || lower.endsWith("thousand")) {
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n * 1000;
  }
  // handle "5 thousand" form already via multiplied? we handle via parse first token
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function extract(text: string, dimension: "financial" | "emotional" | "temporal" | string): ExtractedValue | null {
  const patterns = EXTRACTION_PATTERNS[dimension] ?? EXTRACTION_PATTERNS.financial;
  const fuzzy = detectFuzzy(text);

  for (const re of patterns) {
    // need fresh regex per call because /g lastIndex
    const fresh = new RegExp(re.source, re.flags);
    const m = fresh.exec(text);
    if (m) {
      // collect first numeric capture
      let raw: string | undefined;
      for (let i = 1; i < m.length; i++) {
        if (m[i] && /\d/.test(m[i])) {
          raw = m[i];
          // include suffix if present (k, thousand)
          if (m[i+1] && /^(k|thousand)$/i.test(m[i+1])) raw = `${m[i]} ${m[i+1]}`;
          break;
        }
      }
      if (!raw) raw = m[0];
      // handle "$4,500" includes $ — use full match for that pattern
      const val = (() => {
        if (/\$/.test(m[0])) {
          // money pattern — full match includes $
          const num = m[0].match(/[\d,]+(?:\.\d+)?/);
          if (!num) return null;
          return toNumber(num[0]);
        }
        // "5k" case — raw already "5" + "k"
        return toNumber(raw);
      })();
      if (val === null || val === undefined) continue;
      const confidence = fuzzy.confidence;
      const tolerance = fuzzy.modifier && fuzzy.modifier !== "at least" && fuzzy.modifier !== "up to"
        ? val * fuzzy.tolerance
        : 0;
      return {
        value: val,
        tolerance,
        confidence,
        source: "direct_extraction",
        original_text: text,
      };
    }
  }
  // Fallback: generic number before dimension keyword (e.g., "5 months of savings")
  // already covered by patterns, so null if no match
  return null;
}

// Confidence mapping per spec §24: HIGH ≥0.90, MEDIUM 0.70-0.89 handled by translator
export function confidenceToNumber(c: "HIGH" | "MEDIUM"): number {
  return c === "HIGH" ? 0.9 : 0.75;
}
