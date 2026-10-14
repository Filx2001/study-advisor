import { describe, it, expect } from "vitest";
import { searchCatalog, priceInQAR } from "../lib/search";

const ids = (filters: Parameters<typeof searchCatalog>[0]) =>
  searchCatalog(filters)
    .map((p) => p.id)
    .sort();

describe("searchCatalog", () => {
  it("returns every programme when there are no filters", () => {
    expect(searchCatalog({})).toHaveLength(14);
  });

  it("filters by field", () => {
    expect(ids({ field: "medicine" })).toEqual(["P03", "P08"]);
  });

  it("lets the free programme pass any budget", () => {
    expect(ids({ maxBudget: 1 })).toEqual(["P04"]);
  });

  it("converts the student's budget before comparing", () => {
    const result = ids({ maxBudget: 3000, budgetCurrency: "USD" });
    expect(result).toContain("P12"); // 28,000 NOK fits
    expect(result).not.toContain("P01"); // 3,200 GBP does not
  });

  it("gives a student with no IELTS only programmes without a requirement", () => {
    expect(ids({ ielts: "none" })).toEqual(["P04", "P08", "P11"]);
  });

  it("treats the IELTS minimum as inclusive", () => {
    const result = ids({ ielts: 5.5 });
    expect(result).toContain("P02"); // needs exactly 5.5
    expect(result).not.toContain("P10"); // needs 7.0
  });

  it("filters to scholarship programmes", () => {
    expect(ids({ scholarshipOnly: true })).toEqual([
      "P02",
      "P05",
      "P08",
      "P12",
    ]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchCatalog({ field: "law", ielts: 6.0 })).toEqual([]);
  });

  it("sorts results cheapest first", () => {
    const prices = searchCatalog({}).map(priceInQAR);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
