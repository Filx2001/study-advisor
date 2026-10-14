import { missingFacts } from "./profile";
import { missingFactReply } from "./fallback";
import type { ChatResponse, Language, Profile } from "./types";

// ---------- Layer 1: input ----------

export const MAX_INPUT_CHARS = 500;

// Control characters, zero-width characters and text-direction overrides can hide
// instructions from humans while models still read them. Newlines and tabs are kept.
function isInvisible(cp: number): boolean {
  return (
    (cp <= 0x1f && cp !== 0x0a && cp !== 0x09) ||
    cp === 0x7f ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2069) ||
    cp === 0xfeff
  );
}

// NFKC turns look-alike characters (e.g. full-width "ｉｇｎｏｒｅ") into normal ones,
// so attacks can't dodge the checks below.
export function sanitizeInput(text: string): string {
  const visible = [...text.normalize("NFKC")]
    .filter((ch) => !isInvisible(ch.codePointAt(0) ?? 0))
    .join("")
    .trim();
  return [...visible].slice(0, MAX_INPUT_CHARS).join("");
}

// Common prompt-injection phrasings, in English and Arabic. Deliberately narrow:
// a missed attack is still caught by the output guards, but a false alarm annoys a real student.
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.!?\n]{0,40}\b(instructions?|rules|prompts?|guidelines|polic(y|ies)|system)\b/i,
  /\b(system|developer|hidden|original)\s+(prompt|message|instructions?)\b/i,
  /\b(reveal|show|print|repeat|leak)\b[^.!?\n]{0,30}\b(your|the\s+system)\s+(instructions?|prompt|rules)\b/i,
  /\byou\s+are\s+now\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /\b(jailbreak|developer\s+mode|DAN\s+mode)\b/i,
  /<\s*\/?\s*(system|assistant|instructions?)\s*>/i,
  /\[\s*(system|inst)\s*\]/i,
  /(?:^|\s)(?:تجاهل|انس|تخط)\s[^.!؟\n]{0,40}(?:التعليمات|الأوامر|القواعد|التوجيهات)/,
  /(?:تعليمات|موجه|رسالة)\s+النظام/,
  /(?:اكشف|اعرض|اطبع|كرر)[^.!؟\n]{0,30}(?:تعليماتك|التعليمات)/,
  /أنت\s+الآن/,
  /تظاهر\s+(?:بأنك|أنك)/,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

const REFUSAL: Record<Language, string> = {
  en: "I'm here to help you find a summer programme from our catalog, so I can't help with that.",
  ar: "أنا هنا لمساعدتك في اختيار برنامج صيفي من الكتالوج، لذلك لا أستطيع المساعدة في ذلك.",
};
const SHOW_AGAIN: Record<Language, string[]> = {
  en: ["Show programmes", "Start over"],
  ar: ["اعرض البرامج", "ابدأ من جديد"],
};

// A server-written reply for blocked messages: polite, on topic, and moves the chat forward.
export function injectionReply(profile: Profile): ChatResponse {
  const lang = profile.language;
  const next =
    missingFacts(profile).length > 0 ? missingFactReply(profile) : undefined;
  return {
    language: lang,
    text: next ? `${REFUSAL[lang]} ${next.text}` : REFUSAL[lang],
    choices: next ? next.choices : [...SHOW_AGAIN[lang]],
    programmes: [],
    profile,
  };
}

// ---------- Layer 3: output ----------

// No links in replies: a hijacked model must not send students to other sites.
export function stripLinks(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]*\)/gi, "$1") // [text](url) -> text
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(
      /\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|ai|app|edu|gov|info|co|me|xyz)\b\S*/gi,
      "",
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Pieces of our system prompt and internal tool names: a reply containing them is leaking internals.
const PROMPT_SECTION_MARKERS = [
  "RULES FOR sendReply",
  "HOW TO WORK",
  "WHAT YOU ALREADY KNOW",
  "CURRENT STUDENT PROFILE",
];
const INTERNAL_NAMES = [
  "savefact",
  "searchcatalog",
  "sendreply",
  "recommendedids",
  "system prompt",
  "toolchoice",
];

export function leaksPrompt(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    PROMPT_SECTION_MARKERS.some((m) => text.includes(m)) ||
    INTERNAL_NAMES.some((m) => lower.includes(m))
  );
}

// ---------- Layer 4: app ----------

export function rateLimitReply(profile: Profile): ChatResponse {
  const ar = profile.language === "ar";
  return {
    language: profile.language,
    text: ar
      ? "أنت ترسل الرسائل بسرعة كبيرة. انتظر قليلًا ثم حاول مرة أخرى."
      : "You're sending messages very quickly. Please wait a moment and try again.",
    choices: ar ? ["حاول مرة أخرى"] : ["Try again"],
    programmes: [],
    profile,
  };
}
