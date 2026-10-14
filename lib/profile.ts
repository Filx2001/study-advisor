import { z } from "zod";
import { FieldSchema, CurrencySchema } from "./schema";
import type { Profile } from "./types";

// Deliberately loose: wrong values are rejected in applyFact with a helpful
// message for the model, instead of crashing the whole tool call.
export const FactsSchema = z.object({
  interest: z.string().optional(),
  budget: z.union([z.number(), z.string()]).optional(), // 5000, "5k", "no limit"
  currency: z.string().optional(),
  ielts: z.union([z.number(), z.string()]).optional(), // 6.5, "6.5", "none"
  noIelts: z.boolean().optional(), // no IELTS / weak English
  wantsScholarship: z.boolean().optional(),
});
export type Facts = z.infer<typeof FactsSchema>;

// "5000", "5,000 QAR", "5k" → 5000; "no limit" → "none"; nonsense → undefined
export function parseBudget(
  value: number | string,
): number | "none" | undefined {
  if (typeof value === "number") return value;
  const v = value.trim().toLowerCase();
  if (/^(none|no limit|unlimited|no budget|any)$/.test(v)) return "none";
  const k = v.match(/^([\d.,\s]+)\s*k$/);
  const n = Number.parseFloat((k ? k[1] : v).replace(/[,\s]/g, ""));
  if (Number.isNaN(n)) return undefined;
  return k ? n * 1000 : n;
}

// 6.5, "6.5", "IELTS 6.5" → 6.5; "none" / "no" → "none"; nonsense → undefined
export function parseIelts(
  value: number | string,
): number | "none" | undefined {
  if (typeof value === "number") return value;
  const v = value.trim().toLowerCase();
  if (/^(none|no|no ielts|without)$/.test(v)) return "none";
  const n = Number.parseFloat(v.replace(/^ielts\s*/, ""));
  return Number.isNaN(n) ? undefined : n;
}

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
    const budget = parseBudget(facts.budget);
    if (budget === "none") {
      next.budget = "none";
      if (next.currency === undefined) next.currency = "QAR"; // currency doesn't matter without a limit
      saved.push("budget");
    } else if (
      budget !== undefined &&
      Number.isFinite(budget) &&
      budget > 0 &&
      budget <= 1_000_000
    ) {
      next.budget = budget;
      saved.push("budget");
    } else {
      rejected.push(
        `budget: "${facts.budget}" is not a positive amount. Use a number, or "none" for no limit.`,
      );
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

  const ielts = facts.noIelts
    ? "none"
    : facts.ielts !== undefined
      ? parseIelts(facts.ielts)
      : undefined;
  if (ielts === "none") {
    next.ielts = "none";
    saved.push("ielts");
  } else if (facts.ielts !== undefined) {
    if (
      ielts !== undefined &&
      ielts >= 0 &&
      ielts <= 9 &&
      Number.isInteger(ielts * 2)
    ) {
      next.ielts = ielts;
      saved.push("ielts");
    } else {
      rejected.push(
        `ielts: "${facts.ielts}" must be between 0 and 9 in steps of 0.5, or "none".`,
      );
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
