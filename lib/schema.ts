import { z } from "zod";

export const FieldSchema = z.enum([
  "computing",
  "engineering",
  "medicine",
  "humanities",
  "business",
  "design",
  "law",
  "science",
]);

export const CurrencySchema = z.enum([
  "GBP",
  "EUR",
  "USD",
  "QAR",
  "MYR",
  "CAD",
  "NOK",
]);

export const ProgramSchema = z.object({
  id: z.string(),
  name_en: z.string(),
  name_ar: z.string(),
  field: FieldSchema,
  host: z.string(),
  country: z.string(),
  teaching_language: z.enum(["en", "ar"]),
  weeks: z.number().int().positive(),
  fee: z.number().nonnegative(),
  currency: CurrencySchema,
  min_ielts: z.number().nullable(),
  scholarship: z.boolean(),
});

export const CatalogSchema = z.array(ProgramSchema);

// The profile is sent by the browser, so it is untrusted: validate it.
export const ProfileSchema = z.object({
  language: z.enum(["ar", "en"]).default("en"),
  interest: FieldSchema.optional(),
  budget: z.union([z.number().positive(), z.literal("none")]).optional(),
  currency: CurrencySchema.optional(),
  ielts: z.union([z.number().min(0).max(9), z.literal("none")]).optional(),
  wantsScholarship: z.boolean().optional(),
  seen: z
    .array(z.string().regex(/^P\d{2}$/))
    .max(20)
    .optional(),
  awaiting: z
    .enum(["interest", "budget", "currency", "ielts", "other"])
    .optional(),
});
