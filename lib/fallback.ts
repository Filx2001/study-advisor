import { missingFacts } from "./profile";
import type { ChatResponse, Language, Profile } from "./types";

type Fact = "interest" | "budget" | "currency" | "ielts";

// Server-written questions and answer buttons for each missing fact.
const QUESTIONS: Record<Fact, Record<Language, string>> = {
  interest: {
    en: "Which field interests you most?",
    ar: "ما المجال الذي يهمك أكثر؟",
  },
  budget: {
    en: "What is your budget, and in which currency?",
    ar: "ما ميزانيتك، وبأي عملة؟",
  },
  currency: {
    en: "Which currency is your budget in?",
    ar: "بأي عملة ميزانيتك؟",
  },
  ielts: {
    en: "Before I can recommend programmes: do you have an IELTS score?",
    ar: "قبل أن أرشّح لك برامج: هل لديك درجة آيلتس؟",
  },
};

const CHOICES: Record<Fact, Record<Language, string[]>> = {
  interest: {
    en: ["Computing", "Business", "Medicine"],
    ar: ["الحوسبة", "الأعمال", "الطب"],
  },
  budget: {
    en: ["Under 5,000 QAR", "Under 15,000 QAR", "No limit"],
    ar: ["أقل من 5000 ريال", "أقل من 15000 ريال", "بدون حد"],
  },
  currency: { en: ["QAR", "USD", "EUR"], ar: ["ريال قطري", "دولار", "يورو"] },
  ielts: {
    en: ["No IELTS", "IELTS 5.5", "IELTS 6.5"],
    ar: ["ليس لدي آيلتس", "آيلتس 5.5", "آيلتس 6.5"],
  },
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
  return fact ? [...CHOICES[fact][profile.language]] : [];
}

// A server-written question for the next missing fact.
export function missingFactReply(profile: Profile): ChatResponse {
  const fact = nextFact(profile);
  if (!fact) return fallbackReply(profile);
  return {
    language: profile.language,
    text: QUESTIONS[fact][profile.language],
    choices: [...CHOICES[fact][profile.language]],
    programmes: [],
    profile,
  };
}
