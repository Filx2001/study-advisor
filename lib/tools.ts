import { tool } from "ai";
import { z } from "zod";
import { FactsSchema, applyFact, missingFacts } from "./profile";
import { searchCatalog, priceInQAR } from "./search";
import { FieldSchema, CurrencySchema } from "./schema";
import type { Currency, Field, Profile } from "./types";
import type { RawReply } from "./guards";

// Everything one request needs; tools write into it, guards read from it.
export type TurnContext = {
  profile: Profile;
  allowedIds: Set<string>;
  reply?: RawReply;
};

// Deliberately loose: field and currency are checked in execute(),
// so a wrong value gets an explanation instead of crashing the turn.
const SearchInputSchema = z.object({
  field: z.string().optional(),
  maxBudget: z.number().optional(),
  budgetCurrency: z.string().optional(),
  ielts: z.number().optional(),
  noIelts: z.boolean().optional(),
  teachingLanguage: z.enum(["en", "ar"]).optional(),
  scholarshipOnly: z.boolean().optional(),
  country: z.string().optional(),
});

// Deliberately loose: the real limits (3 choices, 20 chars, known ids)
// are enforced in guardReply, so a misbehaving model is corrected, not crashed.
const ReplyInputSchema = z.object({
  text: z.string(),
  choices: z.array(z.string()),
  recommendedIds: z.array(z.string()),
});

export function createTools(ctx: TurnContext) {
  return {
    saveFact: tool({
      description:
        "Save facts the student just told you (interest, budget, currency, IELTS, scholarship). " +
        "Call it every time the student shares one. Returns what was saved, what was rejected and why, " +
        "and the facts still missing.",
      inputSchema: FactsSchema,
      execute: async (facts) => {
        const result = applyFact(ctx.profile, facts);
        ctx.profile = result.profile;
        return {
          saved: result.saved,
          rejected: result.rejected,
          missing: missingFacts(ctx.profile),
        };
      },
    }),

    searchCatalog: tool({
      description:
        "Search the official programme catalog — the ONLY source of programmes. " +
        "Only programmes returned here may be recommended. Budgets are compared after currency conversion.",
      inputSchema: SearchInputSchema,
      execute: async ({ noIelts, ielts, field, budgetCurrency, ...rest }) => {
        let fieldValue: Field | undefined;
        if (field !== undefined) {
          const parsed = FieldSchema.safeParse(field.trim().toLowerCase());
          if (!parsed.success) {
            return {
              count: 0,
              programmes: [],
              error: `Unknown field "${field}". Valid fields: ${FieldSchema.options.join(", ")}.`,
            };
          }
          fieldValue = parsed.data;
        }

        let currencyValue: Currency | undefined;
        if (budgetCurrency !== undefined) {
          const parsed = CurrencySchema.safeParse(
            budgetCurrency.trim().toUpperCase(),
          );
          if (!parsed.success) {
            return {
              count: 0,
              programmes: [],
              error: `Unknown currency "${budgetCurrency}". Use one of: ${CurrencySchema.options.join(", ")}.`,
            };
          }
          currencyValue = parsed.data;
        }

        const results = searchCatalog({
          ...rest,
          field: fieldValue,
          budgetCurrency: currencyValue,
          ielts: noIelts ? "none" : ielts,
        });
        for (const p of results) ctx.allowedIds.add(p.id);

        const lang = ctx.profile.language;
        return {
          count: results.length,
          programmes: results.map((p) => ({
            id: p.id,
            name: lang === "ar" ? p.name_ar : p.name_en,
            field: p.field,
            host: p.host,
            country: p.country,
            weeks: p.weeks,
            fee: `${p.fee} ${p.currency}`,
            approxPriceQAR: priceInQAR(p),
            teachingLanguage: p.teaching_language,
            minIelts: p.min_ielts,
            scholarship: p.scholarship,
          })),
        };
      },
    }),

    sendReply: tool({
      description:
        "Send your message to the student. You MUST call this exactly once, as the last step of every turn.",
      inputSchema: ReplyInputSchema,
      execute: async (reply) => {
        ctx.reply = reply;
        return { delivered: true };
      },
    }),
  };
}
