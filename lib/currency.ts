import type { Currency } from "./types";

// Approximate fixed rates: 1 unit of currency = X QAR.
// Not live rates — good enough to compare programme prices.
// QAR is pegged to USD at 3.64.
export const RATES_TO_QAR: Record<Currency, number> = {
  QAR: 1,
  USD: 3.64,
  EUR: 4.15,
  GBP: 4.85,
  CAD: 2.65,
  MYR: 0.85,
  NOK: 0.35,
};

export function toQAR(amount: number, currency: Currency): number {
  return Math.round(amount * RATES_TO_QAR[currency]);
}
