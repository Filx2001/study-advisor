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

function budgetInQAR(filters: SearchFilters): number | undefined {
  return filters.maxBudget !== undefined
    ? toQAR(filters.maxBudget, filters.budgetCurrency ?? "QAR")
    : undefined;
}

export function searchCatalog(
  filters: SearchFilters,
  programs: Program[] = catalog,
): Program[] {
  const budgetQAR = budgetInQAR(filters);

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

export type ClosestMatch = {
  program: Program;
  doesNotFit: string[];
  score: number;
};

// When nothing matches exactly: rank the other programmes by how badly they miss.
// A different field counts most, then English level, then how far over budget.
export function closestMatches(
  filters: SearchFilters,
  limit = 3,
  programs: Program[] = catalog,
): ClosestMatch[] {
  const budgetQAR = budgetInQAR(filters);
  const country = filters.country?.trim().toLowerCase();

  return programs
    .map((p) => {
      const doesNotFit: string[] = [];
      let score = 0;
      if (filters.field && p.field !== filters.field) {
        score += 3;
        doesNotFit.push(`different field (${p.field})`);
      }
      if (!meetsEnglish(p, filters.ielts)) {
        score += 2;
        doesNotFit.push(`needs IELTS ${p.min_ielts}`);
      }
      if (budgetQAR !== undefined && priceInQAR(p) > budgetQAR) {
        const over = priceInQAR(p) - budgetQAR;
        score += 1 + over / Math.max(budgetQAR, 1); // slightly over is much better than far over
        doesNotFit.push(
          `over budget by about ${over.toLocaleString("en")} QAR`,
        );
      }
      if (
        filters.teachingLanguage &&
        p.teaching_language !== filters.teachingLanguage
      ) {
        score += 2;
        doesNotFit.push("taught in a different language");
      }
      if (filters.scholarshipOnly && !p.scholarship) {
        score += 1;
        doesNotFit.push("no scholarship");
      }
      if (country && p.country.toLowerCase() !== country) {
        score += 1;
        doesNotFit.push(`in ${p.country}`);
      }
      return { program: p, doesNotFit, score };
    })
    .filter((c) => c.doesNotFit.length > 0) // exact matches belong in searchCatalog's results
    .sort(
      (a, b) =>
        a.score - b.score || priceInQAR(a.program) - priceInQAR(b.program),
    )
    .slice(0, limit);
}
