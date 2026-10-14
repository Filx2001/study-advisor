import { catalog } from "./catalog";
import { toQAR } from "./currency";
import type { Program, Field, Currency, Language } from "./types";

export type SearchFilters = {
  field?: Field;
  maxBudget?: number;
  budgetCurrency?: Currency; // defaults to QAR
  ielts?: number | "none";
  teachingLanguage?: Language;
  scholarshipOnly?: boolean;
  country?: string;
};

export function meetsEnglish(p: Program, ielts?: number | "none"): boolean {
  if (p.min_ielts === null) return true; // no English requirement
  if (ielts === undefined) return true; // level unknown yet: don't filter
  if (ielts === "none") return false; // weak English: only no-requirement programmes
  return ielts >= p.min_ielts;
}

export function priceInQAR(p: Program): number {
  return toQAR(p.fee, p.currency);
}

export function searchCatalog(
  filters: SearchFilters,
  programs: Program[] = catalog,
): Program[] {
  const budgetQAR =
    filters.maxBudget !== undefined
      ? toQAR(filters.maxBudget, filters.budgetCurrency ?? "QAR")
      : undefined;

  return programs
    .filter(
      (p) =>
        (!filters.field || p.field === filters.field) &&
        (budgetQAR === undefined || priceInQAR(p) <= budgetQAR) &&
        meetsEnglish(p, filters.ielts) &&
        (!filters.teachingLanguage ||
          p.teaching_language === filters.teachingLanguage) &&
        (!filters.scholarshipOnly || p.scholarship) &&
        (!filters.country ||
          p.country.toLowerCase() === filters.country.trim().toLowerCase()),
    )
    .sort((a, b) => priceInQAR(a) - priceInQAR(b)); // cheapest first
}
