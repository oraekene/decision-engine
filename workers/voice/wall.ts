// workers/voice/wall.ts — Vocabulary Wall mechanical_pass (v3.5 §35.1, §35.6 Stage A, ticket [27-01])
// Hard-fail list; never patch, regenerate. Echo rule handled upstream.

export const VOCAB_WALL = [
  "leverage",
  "batna",
  "utility",
  "minimax",
  "pareto",
  "red line",
  "frontier",
  "epistemic",
  "tier 1",
  "tier 2",
  "worst-case utility",
  "framework",
  "hypothesis",
  "classification",
  "stakeholder",
  "worst-case",
];

export function mechanicalPass(text: string): { cleaned: string; violations: string[] } {
  const violations: string[] = [];
  const lower = text.toLowerCase();

  // Vocabulary wall
  for (const term of VOCAB_WALL) {
    if (lower.includes(term)) {
      violations.push(`VOCAB WALL BREACH: '${term}'`);
    }
  }

  // Banned shapes (mechanical subset)
  let cleaned = text;
  // Em dashes / en dashes → ,/./()
  if (cleaned.includes("—") || cleaned.includes("–")) {
    cleaned = cleaned.replace(/—/g, ",").replace(/–/g, ",");
    // flag is not hard-fail but report via violations for structural check
    violations.push("EM DASH used");
  }
  // Emoji stripping (internal markers)
  const emojiBefore = cleaned;
  cleaned = cleaned.replace(/[❓➡️🎯⚡🟢🟡🔴❌✅]/g, "");
  if (cleaned !== emojiBefore) violations.push("EMOJI stripped");

  // Curly quotes → straight
  cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // Bold-label list detection (mechanical)
  if (/\*\*[^*]+:\*\*/.test(cleaned)) {
    violations.push("BOLD-LABEL list item");
  }

  return { cleaned, violations };
}

export function humanizeConfidence(level: "HIGH" | "MEDIUM" | "LOW", gap?: number): string {
  if (level === "HIGH") return ""; // state flatly, no hedging
  if (level === "MEDIUM") return "This is my best read, but it's close.";
  return "Honestly, these could flip.";
}

export function humanizeWorstCase(worst: number, baseline: number = 0): string {
  const delta = worst - baseline;
  if (delta >= -0.1) return "If this goes badly, you end up roughly where you are today. Maybe a small step back.";
  if (delta <= -0.5) return "If this goes badly, it hurts. This is the option where a bad break actually costs you.";
  return "If this goes badly, you take a real hit, but you can recover.";
}

export function humanizeGap(gap: number): string {
  if (gap >= 0.4) return "This one isn't close. The next-best option has a meaningfully worse downside.";
  if (gap <= 0.15) return "This is genuinely tight. Two options here are nearly even on the bad-case math, so this may come down to which matters more to you.";
  return "This one has a clear edge on the downside, though the alternative is still viable.";
}
