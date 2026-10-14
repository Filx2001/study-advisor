import { describe, it, expect } from "vitest";
import { closestMatches } from "../lib/search";
import { createTools, type TurnContext } from "../lib/tools";
import { guardReply } from "../lib/guards";
import type { Profile } from "../lib/types";

type Tools = ReturnType<typeof createTools>;
type ExecOptions = Parameters<NonNullable<Tools["saveFact"]["execute"]>>[1];
const opts = { toolCallId: "test", messages: [] } as unknown as ExecOptions;

// The exact case from testing: computing, under 5,000 QAR, IELTS 5.5 — nothing fits exactly.
const filters = {
  field: "computing" as const,
  maxBudget: 5000,
  budgetCurrency: "QAR" as const,
  ielts: 5.5,
};
const complete: Profile = {
  language: "en",
  interest: "computing",
  budget: 5000,
  currency: "QAR",
  ielts: 5.5,
};

describe("closest matches", () => {
  it("prefers the right field slightly over budget to a different field", () => {
    const ids = closestMatches(filters).map((c) => c.program.id);
    expect(ids.slice(0, 2)).toEqual(["P06", "P13"]);
  });

  it("explains what does not fit", () => {
    expect(closestMatches(filters)[0].doesNotFit).toEqual([
      "over budget by about 525 QAR",
    ]);
  });

  it("never includes exact matches", () => {
    expect(
      closestMatches({ field: "medicine" }).every(
        (c) => c.doesNotFit.length > 0,
      ),
    ).toBe(true);
  });

  it("searchCatalog offers the closest options and allows them to be recommended", async () => {
    const ctx: TurnContext = { profile: complete, allowedIds: new Set() };
    const result = await createTools(ctx).searchCatalog.execute!(
      {
        field: "computing",
        maxBudget: 5000,
        budgetCurrency: "QAR",
        ielts: 5.5,
      },
      opts,
    );
    expect(result).toMatchObject({ count: 0 });
    expect(ctx.allowedIds.has("P06")).toBe(true);
  });

  it("attaches searched programmes when the model forgot to", () => {
    const reply = guardReply(
      {
        text: "These are a bit over your budget.",
        choices: [],
        recommendedIds: [],
      },
      { profile: complete, allowedIds: new Set(["P06", "P13"]) },
    );
    expect(reply.programmes.map((p) => p.id)).toEqual(["P06", "P13"]);
  });
});
