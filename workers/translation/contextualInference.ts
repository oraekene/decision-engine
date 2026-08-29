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
