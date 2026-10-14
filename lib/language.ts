import type { Language } from "./types";

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Language of the student's message. If it has no letters at all
// ("6.5", "👍"), keep the language we were already using.
export function detectLanguage(
  text: string,
  previous: Language = "en",
): Language {
  if (ARABIC.test(text)) return "ar";
  if (/\p{L}/u.test(text)) return "en";
  return previous;
}

// Share of letters that are Arabic (0 to 1).
export function arabicRatio(text: string): number {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return 0;
  return letters.filter((ch) => ARABIC.test(ch)).length / letters.length;
}

// Is the model's reply in the expected language?
// Arabic replies may contain English names (e.g. a host university),
// so the Arabic threshold is deliberately lenient.
export function matchesLanguage(text: string, lang: Language): boolean {
  const ratio = arabicRatio(text);
  return lang === "ar" ? ratio >= 0.3 : ratio <= 0.2;
}
