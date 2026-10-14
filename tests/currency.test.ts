import { describe, it, expect } from "vitest";
import { toQAR, RATES_TO_QAR } from "../lib/currency";
import { catalog } from "../lib/catalog";

describe("currency", () => {
  it("keeps QAR unchanged", () => {
    expect(toQAR(800, "QAR")).toBe(800);
  });

  it("uses the USD peg", () => {
    expect(toQAR(100, "USD")).toBe(364);
  });

  it("has a rate for every currency in the catalog", () => {
    for (const p of catalog) {
      expect(RATES_TO_QAR[p.currency]).toBeGreaterThan(0);
    }
  });

  it("knows 28,000 NOK is cheaper than 3,200 GBP", () => {
    expect(toQAR(28000, "NOK")).toBeLessThan(toQAR(3200, "GBP"));
  });
});
