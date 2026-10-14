import type { z } from "zod";
import type { ProgramSchema, FieldSchema, CurrencySchema } from "./schema";

export type Program = z.infer<typeof ProgramSchema>;
export type Field = z.infer<typeof FieldSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Language = "ar" | "en";

export type Profile = {
  interest?: Field;
  budget?: number | "none"; // "none" = no budget limit
  currency?: Currency;
  ielts?: number | "none"; // "none" = no IELTS / weak English
  wantsScholarship?: boolean;
  language: Language;
};

export type ProgrammeCard = {
  id: string;
  name: string; // name_en or name_ar, chosen by the server
  field: Field;
  host: string;
  country: string;
  weeks: number;
  fee: number;
  currency: Currency;
  minIelts: number | null; // null = no English requirement
  scholarship: boolean;
  teachingLanguage: Language;
};

export type ChatResponse = {
  language: Language;
  text: string;
  choices: string[];
  programmes: ProgrammeCard[];
  profile: Profile;
};
