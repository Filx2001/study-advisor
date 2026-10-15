import { describe, it, expect } from "vitest";
import { guardReply, MAX_CHOICES } from "../lib/guards";
import type { Profile } from "../lib/types";

describe("buttons on every reply", () => {
  it("gives 1 to 3 buttons even when the model sends none", () => {
    const complete: Profile = {
      language: "en",
      interest: "medicine",
      budget: 100000,
      currency: "QAR",
      ielts: 5.5,
    };
    const incomplete: Profile = { language: "ar", interest: "medicine" };

    for (const profile of [complete, incomplete]) {
      const text =
        profile.language === "ar" ? "يسعدني أن أساعدك." : "Glad I could help.";
      const answer = guardReply(
        { text, choices: [], recommendedIds: [] },
        { profile, allowedIds: new Set() },
      );
      expect(answer.choices.length).toBeGreaterThan(0);
      expect(answer.choices.length).toBeLessThanOrEqual(MAX_CHOICES);
    }
  });
});
