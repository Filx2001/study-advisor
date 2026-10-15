import { describe, it, expect } from "vitest";
import { guardReply, sanitizeChoices } from "../lib/guards";
import { defaultChoices, missingFactReply } from "../lib/fallback";
import type { Profile } from "../lib/types";

// Everything known except the English level.
const noIelts: Profile = {
  language: "en",
  interest: "business",
  budget: 5000,
  currency: "QAR",
};

describe("missing facts", () => {
  it("asks for the missing fact instead of promising programmes it can't show", () => {
    const reply = guardReply(
      {
        text: "Here are some programmes you might consider.",
        choices: [],
        recommendedIds: ["P05"],
      },
      { profile: noIelts, allowedIds: new Set(["P05"]) },
    );
    expect(reply.programmes).toEqual([]);
    expect(reply).toEqual(missingFactReply(noIelts));
    expect(reply.choices).toContain("No IELTS");
  });

  it("when the model asks about a fact without buttons, the server adds buttons that answer it", () => {
    const reply = guardReply(
      { text: "Do you have an IELTS score?", choices: [], recommendedIds: [] },
      { profile: noIelts, allowedIds: new Set() },
    );
    expect(reply.text).toBe("Do you have an IELTS score?");
    expect(reply.choices).toEqual(["No IELTS", "IELTS 5.5", "IELTS 6.5"]);
    expect(reply.profile.awaiting).toBe("ielts");
  });

  it("default buttons obey the button rules, for every fact and language", () => {
    const profiles: Profile[] = [
      { language: "en" },
      { language: "ar" },
      { language: "en", interest: "law" },
      { language: "ar", interest: "law" },
      { language: "en", interest: "law", budget: 100 },
      { language: "ar", interest: "law", budget: 100 },
      noIelts,
      { ...noIelts, language: "ar" },
    ];
    for (const p of profiles) {
      const choices = defaultChoices(p);
      expect(choices.length).toBeGreaterThan(0);
      expect(sanitizeChoices(choices)).toEqual(choices);
    }
  });
});
