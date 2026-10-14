import { describe, it, expect } from "vitest";
import { cleanText } from "../lib/guards";

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
