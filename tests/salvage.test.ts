import { describe, it, expect } from "vitest";
import { salvagePlainText } from "../lib/salvage";
import { guardReply } from "../lib/guards";

describe("salvagePlainText", () => {
  it("recovers a reply the model wrote as JSON text", () => {
    const raw =
      'Finance fits under Business.\n\nChoices:\n- Yes\n- No\n\n{\n "choices": ["Yes", "No"],\n "recommendedIds": [],\n "text": "Finance fits under Business. Does that sound right?"\n}';
    expect(salvagePlainText(raw)).toEqual({
      text: "Finance fits under Business. Does that sound right?",
      choices: ["Yes", "No"],
      recommendedIds: [],
    });
  });

  it("recovers choices written as a JSON array after 'Choices:'", () => {
    const raw =
      'Do you have an IELTS score?Choices: ["No IELTS","Score 6.0"],"recommendedIds":[]';
    expect(salvagePlainText(raw)).toEqual({
      text: "Do you have an IELTS score?",
      choices: ["No IELTS", "Score 6.0"],
      recommendedIds: [],
    });
  });

  it("removes text the model repeated twice", () => {
    const raw =
      'What is your budget?What is your budget?Choices: ["Under 5,000 QAR"]';
    expect(salvagePlainText(raw)?.text).toBe("What is your budget?");
  });

  it("recovers choices written as a bullet list", () => {
    const raw =
      "What is your budget?\n\nChoices:\n- Under 5,000 QAR\n- No limit";
    expect(salvagePlainText(raw)).toEqual({
      text: "What is your budget?",
      choices: ["Under 5,000 QAR", "No limit"],
      recommendedIds: [],
    });
  });

  it("keeps plain text as it is", () => {
    expect(salvagePlainText("  Hello!  ")).toEqual({
      text: "Hello!",
      choices: [],
      recommendedIds: [],
    });
  });

  it("falls back to text when the braces are not valid JSON", () => {
    expect(salvagePlainText("Use {curly} braces")?.text).toBe(
      "Use {curly} braces",
    );
  });

  it("still sends salvaged replies through the guards", () => {
    const raw =
      '{"text": "Pick one", "choices": ["A","B","C","D","E"], "recommendedIds": ["P99"]}';
    const reply = guardReply(salvagePlainText(raw), {
      profile: { language: "en" },
      allowedIds: new Set(),
    });
    expect(reply.choices).toHaveLength(3);
    expect(reply.programmes).toEqual([]);
  });
});
