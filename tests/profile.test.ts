import { describe, it, expect } from "vitest";
import { applyFact, missingFacts } from "../lib/profile";
import type { Profile } from "../lib/types";

const empty: Profile = { language: "en" };

describe("applyFact", () => {
  it("saves valid facts", () => {
    const r = applyFact(empty, {
      interest: "computing",
      budget: 5000,
      currency: "QAR",
      ielts: 6.5,
    });
    expect(r.profile).toMatchObject({
      interest: "computing",
      budget: 5000,
      currency: "QAR",
      ielts: 6.5,
    });
    expect(r.rejected).toEqual([]);
  });

  it("rejects impossible IELTS scores", () => {
    expect(applyFact(empty, { ielts: 15 }).profile.ielts).toBeUndefined();
    expect(applyFact(empty, { ielts: 6.3 }).rejected).toHaveLength(1);
  });

  it("rejects zero or negative budgets", () => {
    expect(applyFact(empty, { budget: 0 }).profile.budget).toBeUndefined();
    expect(applyFact(empty, { budget: -100 }).profile.budget).toBeUndefined();
  });

  it("stores 'no IELTS' as none", () => {
    expect(applyFact(empty, { noIelts: true }).profile.ielts).toBe("none");
  });

  it("does not change the original profile", () => {
    const original: Profile = { language: "en" };
    applyFact(original, { interest: "law" });
    expect(original).toEqual({ language: "en" });
  });

  it("rejects an interest that is not a catalog field, and explains why", () => {
    const r = applyFact(empty, { interest: "finance" });
    expect(r.profile.interest).toBeUndefined();
    expect(r.rejected[0]).toContain("business");
  });

  it("accepts a field or currency in any letter case", () => {
    const r = applyFact(empty, { interest: "Medicine", currency: "qar" });
    expect(r.profile).toMatchObject({ interest: "medicine", currency: "QAR" });
  });
});

describe("missingFacts", () => {
  it("lists the facts still needed", () => {
    expect(missingFacts({ language: "en", interest: "law" })).toEqual([
      "budget",
      "currency",
      "ielts",
    ]);
  });
});
