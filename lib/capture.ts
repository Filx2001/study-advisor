import { applyFact, missingFacts, type Facts } from "./profile";
import type { Currency, Field, Profile } from "./types";

// Deterministic capture of the ONE fact the server is waiting for, from the student's own message.
// If the model forgets to call saveFact, the answer is still saved. Narrow on purpose:
// when a message is ambiguous, nothing is captured and the model asks again.

const toAsciiDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

// ---------- Field ----------

const FIELD_PHRASES: [string, Field][] = [
  ["العلوم الإنسانية", "humanities"],
  ["الذكاء الاصطناعي", "computing"],
  ["ذكاء اصطناعي", "computing"],
  ["computer science", "computing"],
  ["data science", "computing"],
];

const FIELD_WORDS: Record<Field, string[]> = {
  computing: [
    "computing",
    "computer",
    "computers",
    "programming",
    "coding",
    "ai",
    "robotics",
    "software",
    "الحوسبة",
    "حوسبة",
    "الحاسوب",
    "حاسوب",
    "البرمجة",
    "برمجة",
    "روبوتات",
  ],
  engineering: ["engineering", "engineer", "الهندسة", "هندسة"],
  medicine: [
    "medicine",
    "medical",
    "biology",
    "nursing",
    "pharmacy",
    "doctor",
    "الطب",
    "طب",
    "الأحياء",
    "أحياء",
    "تمريض",
    "صيدلة",
  ],
  humanities: [
    "humanities",
    "history",
    "literature",
    "writing",
    "languages",
    "التاريخ",
    "الأدب",
    "أدب",
    "الكتابة",
  ],
  business: [
    "business",
    "finance",
    "economics",
    "accounting",
    "entrepreneurship",
    "marketing",
    "الأعمال",
    "أعمال",
    "المالية",
    "مالية",
    "الاقتصاد",
    "اقتصاد",
    "المحاسبة",
    "محاسبة",
  ],
  design: [
    "design",
    "architecture",
    "art",
    "arts",
    "calligraphy",
    "التصميم",
    "تصميم",
    "العمارة",
    "عمارة",
    "الفن",
    "فن",
    "الخط",
  ],
  law: ["law", "legal", "debate", "القانون", "قانون", "المحاماة"],
  science: [
    "science",
    "sciences",
    "physics",
    "chemistry",
    "environment",
    "environmental",
    "العلوم",
    "علوم",
    "الفيزياء",
    "فيزياء",
    "الكيمياء",
    "كيمياء",
    "البيئة",
  ],
};

export function detectField(message: string): Field | undefined {
  let text = message.toLowerCase();
  const found = new Set<Field>();
  for (const [phrase, field] of FIELD_PHRASES) {
    if (text.includes(phrase)) {
      found.add(field);
      text = text.split(phrase).join(" ");
    }
  }
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const [field, words] of Object.entries(FIELD_WORDS) as [
    Field,
    string[],
  ][]) {
    if (tokens.some((t) => words.includes(t))) found.add(field);
  }
  return found.size === 1 ? [...found][0] : undefined; // two fields mentioned = ambiguous
}

// ---------- Budget and currency ----------

export function detectCurrency(message: string): Currency | undefined {
  const m = message.toLowerCase();
  if (/\bqar\b|\bqr\b|riyal|rial|ريال/.test(m)) return "QAR";
  if (/\busd\b|dollar|\$|دولار/.test(m)) return "USD";
  if (/\beur\b|euro|€|يورو/.test(m)) return "EUR";
  if (/\bgbp\b|pound|£|جنيه|استرليني/.test(m)) return "GBP";
  if (/\bcad\b/.test(m)) return "CAD";
  if (/\bmyr\b|ringgit/.test(m)) return "MYR";
  if (/\bnok\b|krone/.test(m)) return "NOK";
  return undefined;
}

const NO_LIMIT =
  /\b(no limit|unlimited|no budget|any budget)\b|بدون حد|لا يوجد حد|غير محدودة|مفتوحة/i;

export function detectBudget(
  message: string,
): { amount: number | "none"; currency?: Currency } | undefined {
  if (NO_LIMIT.test(message)) return { amount: "none" };
  const text = toAsciiDigits(message).replace(/(?<=\d),(?=\d{3})/g, ""); // "100,000" -> "100000"
  const m = text.match(/(\d+(?:\.\d+)?)\s*(k)?\b/i);
  if (!m) return undefined;
  const amount = Number(m[1]) * (m[2] ? 1000 : 1);
  if (!Number.isFinite(amount) || amount < 50) return undefined; // "2 brothers" is not a budget
  return { amount, currency: detectCurrency(message) };
}

// ---------- IELTS ----------

const NO_IELTS =
  /\b(no|none|without|don'?t have|do not have)\b|ليس لدي|ما عندي|لا أملك|بدون|^لا$/i;

export function detectIelts(message: string): number | "none" | undefined {
  const m = toAsciiDigits(message).match(/\b(\d(?:\.\d)?)\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 0 && n <= 9 && Number.isInteger(n * 2)) return n;
  }
  if (NO_IELTS.test(message.trim())) return "none";
  return undefined;
}

// ---------- Capture ----------

function withoutAwaiting(profile: Profile): Profile {
  const { awaiting, ...rest } = profile;
  void awaiting;
  return rest;
}

// Save the answer to the question the bot just asked (profile.awaiting), or else to the next missing fact.
// An answer can also CHANGE a known fact (e.g. after "Change field").
// A reply to a question about something else ("other", e.g. a yes/no question) is never captured.
export function captureAnswer(profile: Profile, message: string): Profile {
  const cleared = withoutAwaiting(profile);
  if (profile.awaiting === "other") return cleared;

  const fact = profile.awaiting ?? missingFacts(profile)[0];
  const facts: Facts = {};

  if (fact === "interest") {
    const field = detectField(message);
    if (field) facts.interest = field;
  } else if (fact === "budget") {
    const budget = detectBudget(message);
    if (budget) {
      facts.budget = budget.amount;
      if (budget.currency) facts.currency = budget.currency;
      else if (budget.amount !== "none" && !profile.currency)
        facts.currency = "QAR"; // same rule as the prompt
    }
  } else if (fact === "currency") {
    const currency = detectCurrency(message);
    if (currency) facts.currency = currency;
  } else if (fact === "ielts") {
    const ielts = detectIelts(message);
    if (ielts === "none") facts.noIelts = true;
    else if (ielts !== undefined) facts.ielts = ielts;
  }

  return Object.keys(facts).length > 0
    ? applyFact(cleared, facts).profile
    : cleared;
}
