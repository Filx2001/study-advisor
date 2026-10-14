import { z } from "zod";
import { FieldSchema, CurrencySchema } from "./schema";
import type { Profile } from "./types";

// Deliberately loose: wrong values are rejected in applyFact with a helpful
// message for the model, instead of crashing the whole tool call.
export const FactsSchema = z.object({
  interest: z.string().optional(),
  budget: z.number().optional(),
  currency: z.string().optional(),
  ielts: z.number().optional(),
  noIelts: z.boolean().optional(), // no IELTS / weak English
  wantsScholarship: z.boolean().optional(),
});
export type Facts = z.infer<typeof FactsSchema>;

// Validate facts before saving. Returns a new profile (never mutates),
// plus what was saved and what was rejected, so the model can be told.
export function applyFact(profile: Profile, facts: Facts) {
  const next: Profile = { ...profile };
  const saved: string[] = [];
  const rejected: string[] = [];

  if (facts.interest !== undefined) {
    const field = FieldSchema.safeParse(facts.interest.trim().toLowerCase());
    if (field.success) {
      next.interest = field.data;
      saved.push("interest");
    } else {
      rejected.push(
        `interest: "${facts.interest}" is not a catalog field. Valid fields: ${FieldSchema.options.join(", ")}. ` +
          "Map it to the closest field, or ask the student.",
      );
    }
  }

  if (facts.budget !== undefined) {
    if (
      Number.isFinite(facts.budget) &&
      facts.budget > 0 &&
      facts.budget <= 1_000_000
    ) {
      next.budget = facts.budget;
      saved.push("budget");
    } else {
      rejected.push("budget: must be a positive amount");
    }
  }

  if (facts.currency !== undefined) {
    const currency = CurrencySchema.safeParse(
      facts.currency.trim().toUpperCase(),
    );
    if (currency.success) {
      next.currency = currency.data;
      saved.push("currency");
    } else {
      rejected.push(
        `currency: "${facts.currency}" is not supported. Use one of: ${CurrencySchema.options.join(", ")}.`,
      );
    }
  }

  if (facts.noIelts) {
    next.ielts = "none";
    saved.push("ielts");
  } else if (facts.ielts !== undefined) {
    if (
      facts.ielts >= 0 &&
      facts.ielts <= 9 &&
      Number.isInteger(facts.ielts * 2)
    ) {
      next.ielts = facts.ielts;
      saved.push("ielts");
    } else {
      rejected.push("ielts: must be between 0 and 9 in steps of 0.5");
    }
  }

  if (facts.wantsScholarship !== undefined) {
    next.wantsScholarship = facts.wantsScholarship;
    saved.push("wantsScholarship");
  }

  return { profile: next, saved, rejected };
}

export function missingFacts(profile: Profile): string[] {
  const missing: string[] = [];
  if (profile.interest === undefined) missing.push("interest");
  if (profile.budget === undefined) missing.push("budget");
  if (profile.currency === undefined) missing.push("currency");
  if (profile.ielts === undefined) missing.push("ielts");
  return missing;
}
