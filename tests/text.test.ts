import { describe, it, expect } from "vitest";
import {
  cleanText,
  keepFirstQuestion,
  choicesInLanguage,
  mentionsUnknownInstitution,
  guardReply,
} from "../lib/guards";
import type { Profile } from "../lib/types";

describe("cleanText", () => {
  it("removes markdown bold markers the UI can't render", () => {
    expect(cleanText("**Economics & Policy Seminar** at Lakeside")).toBe(
      "Economics & Policy Seminar at Lakeside",
    );
  });

  it("removes markdown headings", () => {
    expect(cleanText("## Your options\nHere they are.")).toBe(
      "Your options\nHere they are.",
    );
  });
});

describe("one question per message", () => {
  it("keeps only the first of two questions", () => {
    expect(
      keepFirstQuestion("Great! What is your budget? And do you have IELTS?"),
    ).toBe("Great! What is your budget?");
  });

  it("counts the Arabic question mark", () => {
    expect(keepFirstQuestion("ما ميزانيتك؟ وهل لديك آيلتس؟")).toBe(
      "ما ميزانيتك؟",
    );
  });

  it("leaves a single question untouched", () => {
    const text = "What is your budget? Take your time.";
    expect(keepFirstQuestion(text)).toBe(text);
  });
});

describe("buttons in the reply language", () => {
  it("drops English buttons under an Arabic reply", () => {
    expect(choicesInLanguage(["Computing", "الطب"], "ar")).toEqual(["الطب"]);
  });

  it("drops Arabic buttons under an English reply", () => {
    expect(choicesInLanguage(["الطب", "Medicine"], "en")).toEqual(["Medicine"]);
  });

  it("keeps buttons without letters", () => {
    expect(choicesInLanguage(["5000", "6.5"], "ar")).toEqual(["5000", "6.5"]);
  });

  it("replaces wrong-language buttons with the right defaults", () => {
    const profile: Profile = {
      language: "ar",
      interest: "medicine",
      budget: 3000,
      currency: "QAR",
    };
    const reply = guardReply(
      {
        text: "هل لديك درجة آيلتس؟",
        choices: ["No IELTS", "IELTS 6.0"],
        recommendedIds: [],
      },
      { profile, allowedIds: new Set() },
    );
    expect(reply.choices).toEqual(["ليس لدي آيلتس", "آيلتس 5.5", "آيلتس 6.5"]);
  });
});

describe("no institutions outside the catalog", () => {
  it("flags famous universities that are not in the catalog", () => {
    expect(mentionsUnknownInstitution("You should apply to Harvard!")).toBe(
      true,
    );
    expect(mentionsUnknownInstitution("جرّب برنامج هارفارد الصيفي")).toBe(true);
  });

  it("flags invented institutions", () => {
    expect(
      mentionsUnknownInstitution("Try the Riverside Institute of Technology."),
    ).toBe(true);
  });

  it("allows hosts from the catalog", () => {
    expect(
      mentionsUnknownInstitution(
        "The seminar at Lakeside Technical University fits you.",
      ),
    ).toBe(false);
    expect(
      mentionsUnknownInstitution("Canal School of Design runs a studio."),
    ).toBe(false);
  });

  it("ignores generic phrases", () => {
    expect(
      mentionsUnknownInstitution("A Summer School could be a great fit."),
    ).toBe(false);
  });

  it("replaces a reply that names an unknown institution", () => {
    const profile: Profile = { language: "en", interest: "law" };
    const reply = guardReply(
      {
        text: "Harvard Law School is perfect for you!",
        choices: [],
        recommendedIds: [],
      },
      { profile, allowedIds: new Set() },
    );
    expect(reply.text).toContain("only recommend programmes from our catalog");
    expect(reply.programmes).toEqual([]);
  });
});
