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
