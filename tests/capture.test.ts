import { describe, it, expect } from "vitest";
import {
  captureAnswer,
  detectField,
  detectBudget,
  detectIelts,
} from "../lib/capture";
import { guardReply } from "../lib/guards";
import { converse, reply } from "./helpers/mock";
import type { Profile } from "../lib/types";

describe("capturing the expected answer in code", () => {
  it("recognises the field in English and Arabic, and refuses ambiguous answers", () => {
    expect(detectField("I like medicine")).toBe("medicine");
    expect(detectField("أحب الطب")).toBe("medicine");
    expect(detectField("finance")).toBe("business");
    expect(detectField("العلوم الإنسانية")).toBe("humanities");
    expect(detectField("medicine or law")).toBeUndefined(); // two fields: let the model ask
    expect(detectField("hello")).toBeUndefined();
  });

  it("recognises budgets, currencies and 'no limit'", () => {
    expect(detectBudget("100000 qar")).toEqual({
      amount: 100000,
      currency: "QAR",
    });
    expect(detectBudget("Under 5,000 QAR")).toEqual({
      amount: 5000,
      currency: "QAR",
    });
    expect(detectBudget("ميزانيتي ٣٠٠٠ ريال")).toEqual({
      amount: 3000,
      currency: "QAR",
    });
    expect(detectBudget("5k usd")).toEqual({ amount: 5000, currency: "USD" });
    expect(detectBudget("No limit")).toEqual({ amount: "none" });
    expect(detectBudget("I have 2 brothers")).toBeUndefined();
  });

  it("recognises IELTS answers", () => {
    expect(detectIelts("5.5")).toBe(5.5);
    expect(detectIelts("IELTS 6.5")).toBe(6.5);
    expect(detectIelts("No IELTS")).toBe("none");
    expect(detectIelts("ليس لدي آيلتس")).toBe("none");
    expect(detectIelts("yes")).toBeUndefined();
  });

  it("only captures the fact it is waiting for", () => {
    const profile = captureAnswer(
      { language: "en" },
      "medicine, and my budget is 5000 QAR",
    );
    expect(profile).toEqual({ language: "en", interest: "medicine" });
  });

  it("keeps a plain statement from the model and adds the matching question and buttons", () => {
    const profile: Profile = {
      language: "en",
      interest: "business",
      budget: 5000,
      currency: "QAR",
    };
    const answer = guardReply(
      { text: "IELTS is an English test.", choices: [], recommendedIds: [] },
      { profile, allowedIds: new Set() },
    );
    expect(answer.text).toBe(
      "IELTS is an English test. Before I can recommend programmes: do you have an IELTS score?",
    );
    expect(answer.choices).toEqual(["No IELTS", "IELTS 5.5", "IELTS 6.5"]);
  });

  it("the screenshot case: '100000 qar' is saved even though the model forgot saveFact, and the buttons match the question", async () => {
    const { replies } = await converse(
      [
        {
          say: "100000 qar",
          // The model claims it saved the budget, never calls saveFact, and sends no buttons.
          model: [
            reply(
              "Great, 100,000 QAR noted. Do you have an IELTS score, or would you need a programme without one?",
            ),
          ],
        },
      ],
      { language: "en", interest: "computing" },
    );
    expect(replies[0].profile).toMatchObject({
      budget: 100000,
      currency: "QAR",
    });
    expect(replies[0].text).toBe(
      "Great, 100,000 QAR noted. Do you have an IELTS score, or would you need a programme without one?",
    );
    expect(replies[0].choices).toEqual(["No IELTS", "IELTS 5.5", "IELTS 6.5"]);
  });
});
