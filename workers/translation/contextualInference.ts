// workers/translation/contextualInference.ts — Tier3 deterministic (v3.2 §5.5, NO LLM)
// Ticket [5-03]: pure TS, lint rule forbids llm import.

export type InferredValue = {
  value: number;
  confidence: number;
  basis: string;
  method: "contextual_inference";
};

export function inferFinancialRunway(savings_amount: number, monthly_expenses: number): InferredValue {
  if (monthly_expenses <= 0) throw new Error("monthly_expenses must be >0");
  const runway = savings_amount / monthly_expenses;
  return {
    value: runway,
    confidence: 0.90,
    basis: `Calculated: ${savings_amount} / ${monthly_expenses}`,
    method: "contextual_inference",
  };
}

export function inferIncomeFloor(total_obligations: number): InferredValue {
  return {
    value: total_obligations,
    confidence: 0.95,
    basis: `Floor equals stated obligations: ${total_obligations}`,
    method: "contextual_inference",
  };
}

const SAVINGS_CUES = ["sav", "bank", "set aside", "emergency fund", "in reserve", "nest egg"];
const EXPENSE_CUES = ["spend", "expenses", "monthly", "burn", "costs", "bills", "outgoing", "overhead"];
const AMOUNT = /\$?(\d+(?:,\d{3})*(?:\.\d+)?)/g;

// Text-level Tier3 entry: fires only when the text carries both an explicit
// savings cue and an explicit monthly-expense cue alongside at least two
// amounts (first = savings, last = monthly burn). Anything else returns null
// so the translator falls through to null exactly as before.
export function inferFromText(text: string): InferredValue | null {
  const lower = text.toLowerCase();
  if (!SAVINGS_CUES.some((c) => lower.includes(c))) return null;
  if (!EXPENSE_CUES.some((c) => lower.includes(c))) return null;
  const amounts = [...text.matchAll(AMOUNT)]
    .map((m) => parseFloat(m[1].replace(/,/g, "")))
    .filter((n) => !isNaN(n));
  if (amounts.length < 2) return null;
  const monthly = amounts[amounts.length - 1];
  if (monthly <= 0) return null;
  return inferFinancialRunway(amounts[0], monthly);
}
