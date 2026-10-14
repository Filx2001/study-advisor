import { describe, it, expect } from "vitest";
import { detectLanguage, matchesLanguage } from "../lib/language";

describe("detectLanguage", () => {
  it("detects English", () => {
    expect(detectLanguage("I like computers")).toBe("en");
  });

  it("detects Arabic", () => {
    expect(detectLanguage("أحب الحاسوب")).toBe("ar");
  });

  it("treats mixed text containing Arabic as Arabic", () => {
    expect(detectLanguage("أريد IELTS 6")).toBe("ar");
  });

  it("keeps the previous language when there are no letters", () => {
    expect(detectLanguage("6.5", "ar")).toBe("ar");
    expect(detectLanguage("👍", "en")).toBe("en");
  });
});

describe("matchesLanguage", () => {
  it("accepts Arabic text that contains an English name", () => {
    expect(
      matchesLanguage("أنصحك ببرنامج في Northbridge Institute", "ar"),
    ).toBe(true);
  });

  it("rejects an English reply when Arabic is expected", () => {
    expect(matchesLanguage("Here is a great programme", "ar")).toBe(false);
  });

  it("rejects an Arabic reply when English is expected", () => {
    expect(matchesLanguage("هذا برنامج رائع", "en")).toBe(false);
  });
});
