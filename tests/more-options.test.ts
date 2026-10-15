import { describe, it, expect } from "vitest";
import { createTools, type TurnContext } from "../lib/tools";
import { guardReply } from "../lib/guards";
import { converse, reply, step, call } from "./helpers/mock";
import type { Profile } from "../lib/types";

type Tools = ReturnType<typeof createTools>;
type ExecOptions = Parameters<NonNullable<Tools["saveFact"]["execute"]>>[1];
const opts = { toolCallId: "test", messages: [] } as unknown as ExecOptions;

// The case from testing: only one computing programme fits everything.
const computing: Profile = {
  language: "en",
  interest: "computing",
  budget: 6000,
  currency: "QAR",
  ielts: 5.5,
};
const filters = {
  field: "computing",
  maxBudget: 6000,
  budgetCurrency: "QAR",
  ielts: 5.5,
};

describe("more options", () => {
  it("search marks programmes already shown and offers new alternatives", async () => {
    const ctx: TurnContext = {
      profile: { ...computing, seen: ["P06"] },
      allowedIds: new Set(),
    };
    const result = await createTools(ctx).searchCatalog.execute!(filters, opts);

    expect(result).toMatchObject({
      count: 1,
      programmes: [{ id: "P06", alreadyShown: true }],
    });
    const alternatives =
      (result as unknown as { alsoConsider?: { id: string }[] }).alsoConsider ??
      [];
    expect(alternatives.map((a) => a.id)).toEqual(["P13", "P04", "P11"]);
    expect([...ctx.allowedIds]).toEqual(
      expect.arrayContaining(["P06", "P13", "P04", "P11"]),
    );
  });

  it("remembers which programmes were shown", () => {
    const answer = guardReply(
      { text: "This one fits you.", choices: [], recommendedIds: ["P06"] },
      { profile: computing, allowedIds: new Set(["P06"]) },
    );
    expect(answer.profile.seen).toEqual(["P06"]);
  });

  it("when attaching forgotten cards, puts programmes the student hasn't seen first", () => {
    const answer = guardReply(
      { text: "Here are more options.", choices: [], recommendedIds: [] },
      {
        profile: { ...computing, seen: ["P06"] },
        allowedIds: new Set(["P06", "P13", "P04"]),
      },
    );
    expect(answer.programmes.map((p) => p.id)).toEqual(["P13", "P04", "P06"]);
  });

  it("'See more options' shows a new programme instead of repeating the same one", async () => {
    const { replies } = await converse(
      [
        {
          say: "Which programme fits me?",
          model: [
            step([call("searchCatalog", filters)]),
            reply("This programme fits you.", ["See more options"], ["P06"]),
          ],
        },
        {
          say: "See more options",
          model: [
            step([call("searchCatalog", filters)]),
            reply(
              "Here is another option; it is over your budget.",
              [],
              ["P13"],
            ),
          ],
        },
      ],
      computing,
    );

    expect(replies[0].programmes.map((p) => p.id)).toEqual(["P06"]);
    expect(replies[1].programmes.map((p) => p.id)).toEqual(["P13"]);
    expect(replies[1].profile.seen).toEqual(["P06", "P13"]);
  });
});
