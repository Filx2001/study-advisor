import { describe, it, expect } from "vitest";
import { detectQuestionTopic, choicesFor } from "../lib/questions";
import { captureAnswer } from "../lib/capture";
import { guardReply } from "../lib/guards";
import { runTurn } from "../lib/chat";
import type { Profile } from "../lib/types";

const engineering: Profile = {
  language: "ar",
  interest: "engineering",
  budget: 100000,
  currency: "QAR",
  ielts: 5.5,
};

describe("buttons answer the message they are under", () => {
  it("recognises what a question is about, in English and Arabic", () => {
    expect(detectQuestionTopic("Which field interests you most?")).toBe(
      "interest",
    );
    expect(
      detectQuestionTopic("What is your budget, and in which currency?"),
    ).toBe("budget");
    expect(detectQuestionTopic("Do you have an IELTS score?")).toBe("ielts");
    expect(detectQuestionTopic("ما هو المجال الجديد الذي تحب استكشافه؟")).toBe(
      "interest",
    );
    expect(detectQuestionTopic("Would you like more details?")).toBeUndefined();
  });

  it("field buttons never offer the field the student already has", () => {
    expect(choicesFor("interest", engineering)).toEqual([
      "الحوسبة",
      "الأعمال",
      "الطب",
    ]);
    expect(
      choicesFor("interest", { language: "en", interest: "computing" }),
    ).toEqual(["Business", "Medicine", "Engineering"]);
  });

  it("the screenshot case: a question about a new field gets field buttons, not 'Change budget'", () => {
    const answer = guardReply(
      {
        text: "ما هو المجال الجديد الذي تحب استكشافه؟",
        choices: [],
        recommendedIds: [],
      },
      { profile: engineering, allowedIds: new Set() },
    );
    expect(answer.choices).toEqual(["الحوسبة", "الأعمال", "الطب"]);
    expect(answer.profile.awaiting).toBe("interest");
  });

  it("a yes/no question gets Yes / No", () => {
    const answer = guardReply(
      {
        text: "Would you like more details about this programme?",
        choices: [],
        recommendedIds: [],
      },
      { profile: { ...engineering, language: "en" }, allowedIds: new Set() },
    );
    expect(answer.choices).toEqual(["Yes", "No"]);
  });

  it("a question it can't classify gets no buttons rather than wrong ones", () => {
    const answer = guardReply(
      {
        text: "Which country would you prefer?",
        choices: [],
        recommendedIds: [],
      },
      { profile: { ...engineering, language: "en" }, allowedIds: new Set() },
    );
    expect(answer.choices).toEqual([]);
  });

  it("tapping 'Change field' is answered by the server, with the other fields as buttons", async () => {
    const answer = await runTurn(
      [{ role: "user", content: "تغيير المجال" }],
      engineering,
      [],
    );
    expect(answer.text).toBe("حسنًا! ما المجال الذي تفضله بدلاً من ذلك؟");
    expect(answer.choices).toEqual(["الحوسبة", "الأعمال", "الطب"]);
    expect(answer.profile.awaiting).toBe("interest");
  });

  it("after 'Change field', the answer changes the saved field", () => {
    const profile = captureAnswer(
      { ...engineering, awaiting: "interest" },
      "طب",
    );
    expect(profile.interest).toBe("medicine");
    expect(profile.awaiting).toBeUndefined();
  });

  it("'No' to a yes/no question is never taken as 'No IELTS'", () => {
    const profile = captureAnswer(
      {
        language: "en",
        interest: "law",
        budget: 100,
        currency: "QAR",
        awaiting: "other",
      },
      "No",
    );
    expect(profile.ielts).toBeUndefined();
  });
});
