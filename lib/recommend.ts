import { searchCatalog, closestMatches, type SearchFilters } from "./search";
import type { Language, Mismatch, Profile, Program } from "./types";

export type Candidate = { program: Program; misses: Mismatch[] };
export type Eligible = { kind: "exact" | "closest"; candidates: Candidate[] };

// The saved facts as search filters.
export function profileFilters(profile: Profile): SearchFilters {
  return {
    field: profile.interest,
    maxBudget: typeof profile.budget === "number" ? profile.budget : undefined,
    budgetCurrency: profile.currency,
    ielts: profile.ielts,
    scholarshipOnly: profile.wantsScholarship === true ? true : undefined,
  };
}

// What may be recommended for this profile — decided by code, not by the model:
// every programme that matches ALL saved facts; if there are none, the 3 closest, each with what doesn't fit.
export function eligibleFor(profile: Profile): Eligible {
  const filters = profileFilters(profile);
  const exact = searchCatalog(filters);
  if (exact.length > 0) {
    return {
      kind: "exact",
      candidates: exact.map((program) => ({ program, misses: [] })),
    };
  }
  return {
    kind: "closest",
    candidates: closestMatches(filters, 3).map((c) => ({
      program: c.program,
      misses: c.misses,
    })),
  };
}

// Server-written texts, used whenever the server decides which cards are shown,
// so the text always describes exactly those cards.
const TEXTS: Record<
  "exactOne" | "exactMany" | "closest" | "allShown",
  Record<Language, string>
> = {
  exactOne: {
    en: "This programme matches everything you told me.",
    ar: "هذا البرنامج يناسب كل ما أخبرتني به.",
  },
  exactMany: {
    en: "These programmes match everything you told me.",
    ar: "هذه البرامج تناسب كل ما أخبرتني به.",
  },
  closest: {
    en: "Nothing matches everything you told me, so these are the closest options. Each card shows what doesn't fit.",
    ar: "لا يوجد برنامج يطابق كل ما أخبرتني به، لذلك هذه أقرب الخيارات. توضح كل بطاقة ما لا يتطابق.",
  },
  allShown: {
    en: "I've already shown you every programme that matches what you told me. You can change your budget, field or English level to see others.",
    ar: "لقد عرضت عليك كل البرامج التي تناسب ما أخبرتني به. يمكنك تغيير الميزانية أو المجال أو مستوى الإنجليزية لرؤية برامج أخرى.",
  },
};

export function recommendationText(
  kind: "exact" | "closest",
  count: number,
  lang: Language,
): string {
  if (kind === "closest") return TEXTS.closest[lang];
  return count === 1 ? TEXTS.exactOne[lang] : TEXTS.exactMany[lang];
}

export function allShownText(lang: Language): string {
  return TEXTS.allShown[lang];
}

export const PREFERENCE_CHOICES: Record<Language, string[]> = {
  en: ["Change budget", "Change field", "Start over"],
  ar: ["تغيير الميزانية", "تغيير المجال", "ابدأ من جديد"],
};
