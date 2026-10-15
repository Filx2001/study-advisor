import { describe, it, expect } from "vitest";
import { guardReply } from "../lib/guards";
import type { Profile } from "../lib/types";

// From testing: computing, 100,000 QAR, IELTS 5.5; both matching programmes already shown.
const profile: Profile = {
  language: "en",
  interest: "computing",
  budget: 100000,
  currency: "QAR",
  ielts: 5.5,
  seen: ["P06", "P13"],
};

describe("programme details", () => {
  it("buttons never show internal programme codes", () => {
    const answer = guardReply(
      {
        text: "Here it is.",
        choices: ["See P13 details", "Start over"],
        recommendedIds: [],
      },
      { profile, allowedIds: new Set() },
    );
    expect(answer.choices).toEqual(["Start over"]);
  });

  it("asking about a programme already shown shows its card again, not 'already shown everything'", () => {
    const answer = guardReply(
      {
        text: "This card shows everything the catalog has about this programme.",
        choices: [],
        recommendedIds: ["P13"],
      },
      { profile, allowedIds: new Set() }, // no new search this turn
    );
    expect(answer.programmes.map((p) => p.id)).toEqual(["P13"]);
    expect(answer.text).toBe(
      "This card shows everything the catalog has about this programme.",
    );
  });

  it("a programme that doesn't fit can still never be shown, searched or not", () => {
    // P01 needs IELTS 6.0; the student has 5.5.
    const answer = guardReply(
      { text: "Here is another one.", choices: [], recommendedIds: ["P01"] },
      { profile, allowedIds: new Set(["P01"]) },
    );
    expect(answer.programmes.map((p) => p.id)).not.toContain("P01");
  });
});
