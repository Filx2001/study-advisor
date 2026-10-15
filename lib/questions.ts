import type { ChatResponse, Field, Language, Profile } from "./types";

// Everything about questions and the buttons that answer them.

export type Fact = "interest" | "budget" | "currency" | "ielts";
export type Awaiting = NonNullable<Profile["awaiting"]>;

const FIELD_ORDER: Field[] = [
  "computing",
  "business",
  "medicine",
  "engineering",
  "science",
  "design",
  "humanities",
  "law",
];

export const FIELD_LABELS: Record<Field, Record<Language, string>> = {
  computing: { en: "Computing", ar: "الحوسبة" },
  engineering: { en: "Engineering", ar: "الهندسة" },
  medicine: { en: "Medicine", ar: "الطب" },
  humanities: { en: "Humanities", ar: "العلوم الإنسانية" },
  business: { en: "Business", ar: "الأعمال" },
  design: { en: "Design", ar: "التصميم" },
  law: { en: "Law", ar: "القانون" },
  science: { en: "Science", ar: "العلوم" },
};

const FIXED_CHOICES: Record<
  Exclude<Fact, "interest">,
  Record<Language, string[]>
> = {
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

// Buttons that answer a question about this fact. Field buttons skip the field already chosen.
export function choicesFor(fact: Fact, profile: Profile): string[] {
  const lang = profile.language;
  if (fact === "interest") {
    return FIELD_ORDER.filter((f) => f !== profile.interest)
      .slice(0, 3)
      .map((f) => FIELD_LABELS[f][lang]);
  }
  return [...FIXED_CHOICES[fact][lang]];
}

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

export function questionFor(fact: Fact, lang: Language): string {
  return QUESTIONS[fact][lang];
}

export const YES_NO: Record<Language, string[]> = {
  en: ["Yes", "No"],
  ar: ["نعم", "لا"],
};

// The question sentence in a reply (up to its question mark), if there is one.
function questionPart(text: string): string | undefined {
  return text.match(/[^.!?؟]*[?؟]/)?.[0]?.trim();
}

// What a reply's question is about, so its buttons can answer it. Undefined when unclear.
export function detectQuestionTopic(text: string): Fact | undefined {
  const q = questionPart(text);
  if (!q) return undefined;
  const found = new Set<Fact>();
  if (/\bbudget\b|\bafford\b|\bspend\b|ميزاني|تكلفة|تنفق/i.test(q))
    found.add("budget");
  else if (/\bcurrency\b|عملة/i.test(q)) found.add("currency");
  if (
    /\bielts\b|english level|level of english|english score|آيلتس|ايلتس|مستوى\s+(?:اللغة\s+)?الإنجليزية/i.test(
      q,
    )
  ) {
    found.add("ielts");
  }
  if (
    /\b(field|subject|major)\b|area of study|interests you|المجال|مجال|تخصص/i.test(
      q,
    )
  )
    found.add("interest");
  return found.size === 1 ? [...found][0] : undefined;
}

export function isYesNoQuestion(text: string): boolean {
  const q = questionPart(text) ?? "";
  return (
    /^(would|do|does|did|are|is|can|could|should|shall|will|have|has|may)\b/i.test(
      q,
    ) || /(^|\s)هل\s/.test(q)
  );
}

// Taps on the server's own buttons ("Change field", "Change budget") are handled in code, not by the model.
type Changeable = "interest" | "budget" | "ielts";

export function detectChangeRequest(message: string): Changeable | undefined {
  const m = message.trim().toLowerCase();
  if (
    /^change (my )?(field|subject|major)$|^(تغيير|غير|غيّر) (المجال|التخصص)$/.test(
      m,
    )
  )
    return "interest";
  if (/^change (my )?budget$|^(تغيير|غير|غيّر) الميزانية$/.test(m))
    return "budget";
  if (
    /^change (my )?(english level|ielts)$|^(تغيير|غير|غيّر) (مستوى الإنجليزية|الآيلتس)$/.test(
      m,
    )
  )
    return "ielts";
  return undefined;
}

const CHANGE_QUESTIONS: Record<Changeable, Record<Language, string>> = {
  interest: {
    en: "Sure! Which field would you like instead?",
    ar: "حسنًا! ما المجال الذي تفضله بدلاً من ذلك؟",
  },
  budget: {
    en: "Sure! What budget would you like to use instead?",
    ar: "حسنًا! ما الميزانية التي تريد استخدامها بدلاً من ذلك؟",
  },
  ielts: {
    en: "Sure! What is your IELTS score?",
    ar: "حسنًا! ما درجتك في الآيلتس؟",
  },
};

export function changeReply(profile: Profile, fact: Changeable): ChatResponse {
  return {
    language: profile.language,
    text: CHANGE_QUESTIONS[fact][profile.language],
    choices: choicesFor(fact, profile),
    programmes: [],
    profile: { ...profile, awaiting: fact },
  };
}
