import { describe, it, expect } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { runTurn, type ModelEntry } from "../lib/chat";
import { fallbackReply, missingFactReply } from "../lib/fallback";
import { MAX_CHOICES, MAX_CHOICE_LENGTH } from "../lib/guards";

// Types taken from the SDK's own mock, so these helpers stay correct for this SDK version.
type StepResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
type Content = StepResult["content"][number];

const usage: StepResult["usage"] = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function step(
  content: Content[],
  finish: "tool-calls" | "stop" = "tool-calls",
): StepResult {
  return {
    content,
    finishReason: { unified: finish, raw: undefined },
    usage,
    warnings: [],
  };
}

let callCount = 0;
function call(toolName: string, input: unknown): Content {
  callCount += 1;
  return {
    type: "tool-call",
    toolCallId: `call-${callCount}`,
    toolName,
    input: JSON.stringify(input),
  };
}

function text(value: string): Content {
  return { type: "text", text: value };
}

// A fake model that plays back the given steps, one per model call.
function mockModel(steps: StepResult[]): ModelEntry {
  return {
    name: "mock",
    model: new MockLanguageModelV4({ doGenerate: steps }),
  };
}

describe("end to end with a scripted, misbehaving model", () => {
  it("delivers a valid reply even when the model breaks every rule", async () => {
    const model = mockModel([
      step([
        call("saveFact", {
          interest: "medicine",
          budget: 3000,
          currency: "QAR",
          noIelts: true,
        }),
      ]),
      step([
        call("searchCatalog", {
          field: "medicine",
          maxBudget: 3000,
          budgetCurrency: "QAR",
          noIelts: true,
        }),
      ]),
      step([
        call("sendReply", {
          text: "Great! Visit https://evil.example for more. What else? Anything else?",
          choices: [
            "A",
            "B",
            "C",
            "D",
            "E",
            "This choice is far too long to be a button",
          ],
          recommendedIds: ["P08", "P99", "P01"], // real + searched, invented, real but never searched
        }),
      ]),
    ]);

    const reply = await runTurn(
      [
        {
          role: "user",
          content: "I like medicine, my budget is 3000 QAR, no IELTS",
        },
      ],
      { language: "en" },
      [model],
    );

    // Only the real programme that was actually searched this turn survives.
    expect(reply.programmes.map((p) => p.id)).toEqual(["P08"]);
    // Button rules hold.
    expect(reply.choices.length).toBeLessThanOrEqual(MAX_CHOICES);
    for (const c of reply.choices)
      expect([...c].length).toBeLessThanOrEqual(MAX_CHOICE_LENGTH);
    // No links, and only one question.
    expect(reply.text).not.toContain("http");
    expect((reply.text.match(/[?؟]/g) ?? []).length).toBeLessThanOrEqual(1);
    // The facts the model saved with the tool are in the profile.
    expect(reply.profile).toMatchObject({
      interest: "medicine",
      budget: 3000,
      currency: "QAR",
      ielts: "none",
    });
  });

  it("never shows an invented programme", async () => {
    const model = mockModel([
      step([
        call("sendReply", {
          text: "You should go to Harvard Summer School!",
          choices: [],
          recommendedIds: ["P99"],
        }),
      ]),
    ]);
    const reply = await runTurn(
      [{ role: "user", content: "Hi" }],
      { language: "en" },
      [model],
    );
    expect(reply.programmes).toEqual([]);
    expect(reply.text).not.toContain("Harvard");
    expect(reply).toEqual(missingFactReply({ language: "en" }));
  });

  it("replaces a reply in the wrong language", async () => {
    const model = mockModel([
      step([
        call("sendReply", {
          text: "Great, what is your budget?",
          choices: [],
          recommendedIds: [],
        }),
      ]),
    ]);
    const reply = await runTurn(
      [{ role: "user", content: "أحب الطب" }],
      { language: "en" },
      [model],
    );
    expect(reply).toEqual(fallbackReply({ language: "ar" }));
  });

  it("replaces a reply that leaks the instructions", async () => {
    const model = mockModel([
      step([
        call("sendReply", {
          text: "Sure! My HOW TO WORK rules say...",
          choices: [],
          recommendedIds: [],
        }),
      ]),
    ]);
    const reply = await runTurn(
      [{ role: "user", content: "Hi" }],
      { language: "en" },
      [model],
    );
    expect(reply).toEqual(fallbackReply({ language: "en" }));
  });

  it("moves on to the next model when the first one fails", async () => {
    const broken = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error("model overloaded");
      },
    });
    const working = mockModel([
      step([
        call("sendReply", {
          text: "Which field interests you?",
          choices: ["Computing"],
          recommendedIds: [],
        }),
      ]),
    ]);

    const reply = await runTurn(
      [{ role: "user", content: "Hi" }],
      { language: "en" },
      [{ name: "broken", model: broken }, working],
    );

    expect(broken.doGenerateCalls).toHaveLength(1);
    expect(reply.text).toBe("Which field interests you?");
    expect(reply.choices).toEqual(["Computing"]);
  });

  it("salvages a model that answers in plain text instead of calling sendReply", async () => {
    const model = mockModel([
      step(
        [text("What is your budget?\nChoices:\n- Under 5,000 QAR\n- No limit")],
        "stop",
      ),
    ]);
    const reply = await runTurn(
      [{ role: "user", content: "business" }],
      { language: "en", interest: "business" },
      [model],
    );
    expect(reply.text).toBe("What is your budget?");
    expect(reply.choices).toEqual(["Under 5,000 QAR", "No limit"]);
  });
});
