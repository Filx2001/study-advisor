import { describe, it, expect } from "vitest";
import { createTools, type TurnContext } from "../lib/tools";
import { guardReply } from "../lib/guards";
import {
  allShownText,
  recommendationText,
  PREFERENCE_CHOICES,
} from "../lib/recommend";
import type { Profile } from "../lib/types";

type Tools = ReturnType<typeof createTools>;
type ExecOptions = Parameters<NonNullable<Tools["saveFact"]["execute"]>>[1];
const opts = { toolCallId: "test", messages: [] } as unknown as ExecOptions;

const medicine: Profile = {
  language: "en",
  interest: "medicine",
  budget: 100000,
  currency: "QAR",
  ielts: 5.5,
};

describe("strict recommendations: only what matches the saved facts", () => {
  it("drops a programme the student doesn't qualify for, and rewrites the text to match the cards", () => {
    // From testing: the model also recommended a course that needs IELTS 6.5 for a student with 5.5.
    const answer = guardReply(
      {
        text: "One fits, and one is close but needs a higher IELTS score.",
        choices: ["More info"],
        recommendedIds: ["P08", "P03"],
      },
      { profile: medicine, allowedIds: new Set(["P08", "P03"]) },
    );
    expect(answer.programmes.map((p) => p.id)).toEqual(["P08"]);
    expect(answer.text).toBe(recommendationText("exact", 1, "en"));
    expect(answer.choices).toEqual(PREFERENCE_CHOICES.en);
  });

  it("never attaches programmes the model didn't choose", () => {
    // From testing: everything matching was already shown, and a broad search returned other fields.
    const answer = guardReply(
      {
        text: "I've already shown you the matching programmes. Anything else?",
        choices: ["I'm all set"],
        recommendedIds: [],
      },
      {
        profile: { ...medicine, seen: ["P08"] },
        allowedIds: new Set(["P04", "P11", "P06"]),
      },
    );
    expect(answer.programmes).toEqual([]);
    expect(answer.text).toBe(
      "I've already shown you the matching programmes. Anything else?",
    );
  });

  it("'more options' after the only match: says so honestly instead of repeating or inventing", () => {
    const computing: Profile = {
      language: "en",
      interest: "computing",
      budget: 6000,
      currency: "QAR",
      ielts: 5.5,
      seen: ["P06"],
    };
    const answer = guardReply(
      {
        text: "Here is another great option!",
        choices: [],
        recommendedIds: ["P13"],
      },
      { profile: computing, allowedIds: new Set(["P06", "P13"]) },
    );
    expect(answer.programmes).toEqual([]);
    expect(answer.text).toBe(allShownText("en"));
  });

  it("when nothing matches, the closest options say exactly what doesn't fit", () => {
    const profile: Profile = {
      language: "en",
      interest: "computing",
      budget: 5000,
      currency: "QAR",
      ielts: 5.5,
    };
    const answer = guardReply(
      {
        text: "Nothing fits exactly; this is the closest.",
        choices: [],
        recommendedIds: ["P06"],
      },
      { profile, allowedIds: new Set(["P06"]) },
    );
    expect(answer.programmes.map((p) => p.id)).toEqual(["P06"]);
    expect(answer.programmes[0].misses).toEqual([
      { kind: "budget", overQAR: 525 },
    ]);
  });

  it("remembers which programmes were shown", () => {
    const answer = guardReply(
      { text: "This one fits you.", choices: [], recommendedIds: ["P08"] },
      { profile: medicine, allowedIds: new Set(["P08"]) },
    );
    expect(answer.profile.seen).toEqual(["P08"]);
  });

  it("search marks programmes the student has already seen", async () => {
    const ctx: TurnContext = {
      profile: { ...medicine, seen: ["P08"] },
      allowedIds: new Set(),
    };
    const result = await createTools(ctx).searchCatalog.execute!(
      {
        field: "medicine",
        maxBudget: 100000,
        budgetCurrency: "QAR",
        ielts: 5.5,
      },
      opts,
    );
    expect(result).toMatchObject({
      count: 1,
      programmes: [{ id: "P08", alreadyShown: true }],
    });
  });
});
