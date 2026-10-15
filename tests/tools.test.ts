import { describe, it, expect } from "vitest";
import { createTools, type TurnContext } from "../lib/tools";

// The exact options type that the tools' execute() expects, derived from our own tools.
type Tools = ReturnType<typeof createTools>;
type ExecOptions = Parameters<NonNullable<Tools["saveFact"]["execute"]>>[1];

const opts = { toolCallId: "test", messages: [] } as unknown as ExecOptions;
const newCtx = (): TurnContext => ({
  profile: { language: "en" },
  allowedIds: new Set(),
});

describe("tools (no model needed)", () => {
  it("searchCatalog records which programmes may be recommended", async () => {
    const ctx = newCtx();
    await createTools(ctx).searchCatalog.execute!({ field: "medicine" }, opts);
    expect([...ctx.allowedIds]).toEqual(expect.arrayContaining(["P03", "P08"]));
  });

  it("searchCatalog explains an unknown field instead of crashing", async () => {
    const ctx = newCtx();
    const result = await createTools(ctx).searchCatalog.execute!(
      { field: "finance" },
      opts,
    );
    expect(result).toMatchObject({ count: 0 });
    expect(ctx.allowedIds.size).toBe(0);
  });

  it("saveFact updates the turn's profile", async () => {
    const ctx = newCtx();
    await createTools(ctx).saveFact.execute!(
      { interest: "law", budget: 3000, currency: "GBP" },
      opts,
    );
    expect(ctx.profile).toMatchObject({
      interest: "law",
      budget: 3000,
      currency: "GBP",
    });
  });

  it("sendReply stores the reply for the guards", async () => {
    const ctx = newCtx();
    const reply = { text: "Hi!", choices: ["OK"], recommendedIds: [] };
    await createTools(ctx).sendReply.execute!(reply, opts);
    expect(ctx.reply).toEqual(reply);
  });
});
