import { describe, it, expect } from "vitest";
import {
  sanitizeChoices,
  filterRecommendations,
  guardReply,
  MAX_CHOICES,
  MAX_CHOICE_LENGTH,
} from "../lib/guards";
import { fallbackReply } from "../lib/fallback";
import type { Profile } from "../lib/types";

const complete: Profile = {
  language: "en",
  interest: "medicine",
  budget: 5000,
  currency: "QAR",
  ielts: "none",
};
const incomplete: Profile = { language: "en", interest: "medicine" };
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

describe("sanitizeChoices", () => {
  it("keeps at most 3 choices", () => {
    expect(sanitizeChoices(["A", "B", "C", "D", "E"])).toEqual(["A", "B", "C"]);
  });

  it("trims whitespace and drops empty choices", () => {
    expect(sanitizeChoices(["  Yes  ", "", "   ", "No"])).toEqual([
      "Yes",
      "No",
    ]);
  });

  it("removes duplicates, ignoring case", () => {
    expect(sanitizeChoices(["Medicine", "medicine", "Law"])).toEqual([
      "Medicine",
      "Law",
    ]);
  });

  it("shortens long choices at a word boundary", () => {
    expect(sanitizeChoices(["Change my budget please"])).toEqual([
      "Change my budget",
    ]);
  });

  it("drops a long choice that cannot be shortened cleanly", () => {
    expect(sanitizeChoices(["Supercalifragilisticexpialidocious"])).toEqual([]);
  });

  it("survives malformed input", () => {
    expect(sanitizeChoices(null)).toEqual([]);
    expect(sanitizeChoices("Yes")).toEqual([]);
    expect(sanitizeChoices([1, "OK", undefined])).toEqual(["OK"]);
  });

  it("measures Arabic choices correctly", () => {
    expect(sanitizeChoices(["معسكر الأحياء التحضيري للطب"])).toEqual([
      "معسكر الأحياء",
    ]);
  });

  it("never breaks the limits, whatever the model sends", () => {
    const messy = [
      "x".repeat(50),
      "a b c d e f g h i j k l m",
      "OK",
      "ok",
      " ",
      "Fine",
      "More",
      "Extra",
    ];
    const result = sanitizeChoices(messy);
    expect(result.length).toBeLessThanOrEqual(MAX_CHOICES);
    for (const c of result)
      expect([...c].length).toBeLessThanOrEqual(MAX_CHOICE_LENGTH);
  });
});

describe("filterRecommendations", () => {
  const searched = new Set(["P08", "P04", "P11", "P03"]);

  it("keeps a real programme that the search returned", () => {
    expect(ids(filterRecommendations(["P08"], searched, complete))).toEqual([
      "P08",
    ]);
  });

  it("removes programmes that do not exist", () => {
    expect(
      ids(
        filterRecommendations(
          ["P99", "Harvard Med", "P08"],
          searched,
          complete,
        ),
      ),
    ).toEqual(["P08"]);
  });

  it("removes real programmes the search did not return", () => {
    expect(filterRecommendations(["P01"], searched, complete)).toEqual([]);
  });

  it("normalizes messy ids", () => {
    expect(ids(filterRecommendations([" p08 "], searched, complete))).toEqual([
      "P08",
    ]);
  });

  it("recommends nothing until the profile is complete", () => {
    expect(filterRecommendations(["P08"], searched, incomplete)).toEqual([]);
  });

  it("removes duplicates and caps at 3", () => {
    expect(
      ids(
        filterRecommendations(
          ["P08", "P08", "P04", "P11", "P03"],
          searched,
          complete,
        ),
      ),
    ).toEqual(["P08", "P04", "P11"]);
  });
});

describe("guardReply", () => {
  const ctx = (profile: Profile) => ({ profile, allowedIds: new Set(["P08"]) });
  const arabic: Profile = { ...complete, language: "ar" };

  it("uses the fallback when the model sent no reply", () => {
    expect(guardReply(undefined, ctx(complete))).toEqual(
      fallbackReply(complete),
    );
  });

  it("uses the fallback when the reply is in the wrong language", () => {
    const reply = {
      text: "Here is a great programme!",
      choices: [],
      recommendedIds: [],
    };
    expect(guardReply(reply, ctx(arabic))).toEqual(fallbackReply(arabic));
  });

  it("builds cards with Arabic names for Arabic replies", () => {
    const reply = {
      text: "هذا البرنامج مناسب لك",
      choices: ["شكرًا"],
      recommendedIds: ["P08"],
    };
    expect(guardReply(reply, ctx(arabic)).programmes[0].name).toBe(
      "معسكر الأحياء التحضيري للطب",
    );
  });

  it("removes internal programme codes from the text", () => {
    const reply = {
      text: "Try P08, it fits.",
      choices: [],
      recommendedIds: ["P08"],
    };
    expect(guardReply(reply, ctx(complete)).text).not.toMatch(/P08/);
  });
});

describe("fallbackReply", () => {
  it("satisfies the button rules itself, in both languages", () => {
    for (const language of ["en", "ar"] as const) {
      const reply = fallbackReply({ language });
      expect(sanitizeChoices(reply.choices)).toEqual(reply.choices);
      expect(reply.text.length).toBeGreaterThan(0);
    }
  });
});
