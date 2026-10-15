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
  seen?: string[]; // programme ids already shown to the student (maintained by the server)
  language: Language;
};

// Why a "closest" programme doesn't match everything the student said (computed by the server).
export type Mismatch =
  | { kind: "field"; field: Field }
  | { kind: "ielts"; min: number }
  | { kind: "budget"; overQAR: number }
  | { kind: "language" }
  | { kind: "scholarship" }
  | { kind: "country"; country: string };

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
  misses?: Mismatch[]; // only on "closest" recommendations: what doesn't fit
};

export type ChatResponse = {
  language: Language;
  text: string;
  choices: string[];
  programmes: ProgrammeCard[];
  profile: Profile;
};
