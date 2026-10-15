import { missingFacts } from "./profile";
import { choicesFor, questionFor, type Fact } from "./questions";
import type { ChatResponse, Language, Profile } from "./types";

const CATALOG_ONLY: Record<Language, string> = {
  en: "I can only recommend programmes from our catalog.",
  ar: "يمكنني فقط ترشيح برامج من الكتالوج الخاص بنا.",
};

// Neutral text used when the model's text can't be trusted but its (validated) cards can.
export const CARDS_INTRO: Record<Language, string> = {
  en: "Here are the programmes from our catalog that fit you best.",
  ar: "إليك البرامج من الكتالوج الأنسب لك.",
};

// A safe reply that always satisfies every rule.
// Used when the model fails, breaks, or answers in the wrong language.
export function fallbackReply(profile: Profile): ChatResponse {
  const ar = profile.language === "ar";
  return {
    language: profile.language,
    text: ar
      ? "عذرًا، حدث خطأ بسيط من جهتي. هل يمكنك المحاولة مرة أخرى؟"
      : "Sorry, something went wrong on my side. Could you try again?",
    choices: ar
      ? ["حاول مرة أخرى", "ابدأ من جديد"]
      : ["Try again", "Start over"],
    programmes: [],
    profile,
  };
}

function nextFact(profile: Profile): Fact | undefined {
  return missingFacts(profile)[0] as Fact | undefined;
}

// Buttons for the next missing fact (empty when nothing is missing).
export function defaultChoices(profile: Profile): string[] {
  const fact = nextFact(profile);
  return fact ? choicesFor(fact, profile) : [];
}

// A server-written question for the next missing fact, with buttons that answer it.
export function missingFactReply(profile: Profile): ChatResponse {
  const fact = nextFact(profile);
  if (!fact) return fallbackReply(profile);
  return {
    language: profile.language,
    text: questionFor(fact, profile.language),
    choices: choicesFor(fact, profile),
    programmes: [],
    profile: { ...profile, awaiting: fact },
  };
}

// Used when the model's text names an institution that isn't in the catalog.
export function catalogOnlyReply(profile: Profile): ChatResponse {
  const lang = profile.language;
  const fact = nextFact(profile);
  return {
    language: lang,
    text: fact
      ? `${CATALOG_ONLY[lang]} ${questionFor(fact, lang)}`
      : CATALOG_ONLY[lang],
    choices: fact ? choicesFor(fact, profile) : [],
    programmes: [],
    profile: fact ? { ...profile, awaiting: fact } : profile,
  };
}
