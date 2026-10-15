import { catalog, getById } from "./catalog";
import { arabicRatio, matchesLanguage } from "./language";
import { stripLinks, leaksPrompt } from "./security";
import {
  fallbackReply,
  missingFactReply,
  defaultChoices,
  catalogOnlyReply,
  CARDS_INTRO,
} from "./fallback";
import type {
  ChatResponse,
  Language,
  Program,
  Profile,
  ProgrammeCard,
} from "./types";

export const MAX_CHOICES = 3;
export const MAX_CHOICE_LENGTH = 20;
export const MAX_RECOMMENDATIONS = 3;
export const MAX_TEXT_LENGTH = 800;
export const MAX_SEEN = 20;

// ---------- Choices ----------

// Count real characters (code points), so Arabic is measured correctly.
export function shortenChoice(choice: string): string {
  const chars = [...choice];
  if (chars.length <= MAX_CHOICE_LENGTH) return choice;
  const cut = chars.slice(0, MAX_CHOICE_LENGTH).join("");
  if (chars[MAX_CHOICE_LENGTH] === " ") return cut.trim(); // word ends exactly at the limit
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace).trim() : ""; // never cut mid-word
}

export function sanitizeChoices(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const result: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const choice = shortenChoice(raw.replace(/\s+/g, " ").trim());
    if (!choice) continue;
    if (result.some((c) => c.toLowerCase() === choice.toLowerCase())) continue;
    result.push(choice);
    if (result.length === MAX_CHOICES) break;
  }
  return result;
}

// Buttons must match the reply language. Buttons without letters ("5000") always pass.
export function choicesInLanguage(choices: string[], lang: Language): string[] {
  return choices.filter((c) => {
    if (!/\p{L}/u.test(c)) return true;
    const ratio = arabicRatio(c);
    return lang === "ar" ? ratio > 0 : ratio < 0.5;
  });
}

// ---------- Recommendations ----------

export function isProfileComplete(profile: Profile): boolean {
  return (
    profile.interest !== undefined &&
    profile.budget !== undefined &&
    profile.currency !== undefined &&
    profile.ielts !== undefined
  );
}

// Keep only programmes that (1) exist in the catalog, (2) were returned by
// searchCatalog this turn, and only once the profile is complete.
export function filterRecommendations(
  ids: unknown,
  allowedIds: ReadonlySet<string>,
  profile: Profile,
): Program[] {
  if (!isProfileComplete(profile) || !Array.isArray(ids)) return [];
  const result: Program[] = [];
  for (const raw of ids) {
    if (typeof raw !== "string") continue;
    const p = getById(raw);
    if (!p || !allowedIds.has(p.id)) continue;
    if (result.some((r) => r.id === p.id)) continue;
    result.push(p);
    if (result.length === MAX_RECOMMENDATIONS) break;
  }
  return result;
}

export function toCard(p: Program, lang: Language): ProgrammeCard {
  return {
    id: p.id,
    name: lang === "ar" ? p.name_ar : p.name_en,
    field: p.field,
    host: p.host,
    country: p.country,
    weeks: p.weeks,
    fee: p.fee,
    currency: p.currency,
    minIelts: p.min_ielts,
    scholarship: p.scholarship,
    teachingLanguage: p.teaching_language,
  };
}

// Programme ids the student has already been shown (kept in the profile, newest last).
export function mergeSeen(seen: string[] | undefined, ids: string[]): string[] {
  return [...new Set([...(seen ?? []), ...ids])].slice(-MAX_SEEN);
}

// ---------- Text ----------

// Remove internal programme codes (students should never see "P08"),
// markdown the UI can't render, tidy spacing, and cap the length.
export function cleanText(text: string): string {
  const cleaned = text
    .replace(/\bP\d{2}\b/gi, "")
    .replace(/\*\*|__|`/g, "") // markdown bold / code markers
    .replace(/^#{1,6}\s+/gm, "") // markdown headings
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?،؟])/g, "$1")
    .trim();
  return [...cleaned].slice(0, MAX_TEXT_LENGTH).join("");
}

// One question per message: if the text asks more than one, keep it up to the end of the first.
export function keepFirstQuestion(text: string): string {
  const first = text.match(/^[\s\S]*?[?؟]/);
  if (!first) return text;
  const rest = text.slice(first[0].length);
  return /[?؟]/.test(rest) ? first[0].trim() : text;
}

// Never name an institution that isn't in the catalog.
const FAMOUS =
  /\b(harvard|mit|stanford|oxford|cambridge|yale|princeton|berkeley)\b|هارفارد|ستانفورد|أكسفورد|اكسفورد|كامبريدج|برينستون/i;
const INSTITUTION_WORDS =
  "University|Institute|College|School|Academy|Centre|Center|Polytechnic";
const NAMED_BEFORE = new RegExp(
  `\\b(?:[A-Z][\\w'&.-]*\\s+){1,4}(?:${INSTITUTION_WORDS})\\b(?:\\s+of\\s+(?:[A-Z][\\w'&.-]*\\s?){1,3})?`,
  "g",
);
const NAMED_AFTER = new RegExp(
  `\\b(?:${INSTITUTION_WORDS})\\s+of\\s+(?:[A-Z][\\w'&.-]*\\s?){1,3}`,
  "g",
);
const IS_INSTITUTION_WORD = new RegExp(`^(?:${INSTITUTION_WORDS}|of)$`, "i");
const GENERIC = new Set([
  "the",
  "a",
  "an",
  "our",
  "your",
  "this",
  "that",
  "these",
  "those",
  "any",
  "each",
  "every",
  "summer",
  "high",
  "local",
  "top",
  "great",
  "good",
  "best",
]);
const KNOWN_NAMES = catalog
  .flatMap((p) => [p.host, p.name_en])
  .map((s) => s.toLowerCase());

export function mentionsUnknownInstitution(text: string): boolean {
  if (FAMOUS.test(text)) return true;
  const found = [
    ...text.matchAll(NAMED_BEFORE),
    ...text.matchAll(NAMED_AFTER),
  ].map((m) => m[0].replace(/[.,!?;:]+$/, "").trim());
  return found.some((name) => {
    const lower = name.toLowerCase();
    if (KNOWN_NAMES.some((k) => lower.includes(k) || k.includes(lower)))
      return false;
    // "A Summer School" is generic, not a name: ignore it.
    const specific = name
      .split(/\s+/)
      .filter(
        (w) => !GENERIC.has(w.toLowerCase()) && !IS_INSTITUTION_WORD.test(w),
      );
    return specific.length > 0;
  });
}

// ---------- The whole reply ----------

export type RawReply =
  | { text?: unknown; choices?: unknown; recommendedIds?: unknown }
  | undefined;

export function guardReply(
  raw: RawReply,
  ctx: { profile: Profile; allowedIds: ReadonlySet<string> },
): ChatResponse {
  const lang = ctx.profile.language;
  let text =
    typeof raw?.text === "string" ? cleanText(stripLinks(raw.text)) : "";

  if (!text || !matchesLanguage(text, lang)) return fallbackReply(ctx.profile);

  // A reply quoting our instructions or tool names is leaking internals.
  if (leaksPrompt(text)) return fallbackReply(ctx.profile);

  // One question per message.
  text = keepFirstQuestion(text);

  let recommended = filterRecommendations(
    raw?.recommendedIds,
    ctx.allowedIds,
    ctx.profile,
  );

  // The model tried to recommend, but nothing survived the checks: its text would
  // promise programmes the student can't see. Ask for what's missing instead, or fall back.
  const ids = raw?.recommendedIds;
  const triedToRecommend = Array.isArray(ids) && ids.length > 0;
  if (triedToRecommend && recommended.length === 0) {
    return isProfileComplete(ctx.profile)
      ? fallbackReply(ctx.profile)
      : missingFactReply(ctx.profile);
  }

  // The model searched this turn but forgot to attach any programmes:
  // attach the best ones it actually found, ones the student hasn't seen first.
  if (!triedToRecommend && ctx.allowedIds.size > 0) {
    const seen = new Set(ctx.profile.seen ?? []);
    const pool = [...ctx.allowedIds];
    const newFirst = [
      ...pool.filter((id) => !seen.has(id)),
      ...pool.filter((id) => seen.has(id)),
    ];
    recommended = filterRecommendations(newFirst, ctx.allowedIds, ctx.profile);
  }

  // The text names an institution that isn't in the catalog: don't show it.
  if (mentionsUnknownInstitution(text)) {
    if (recommended.length === 0) return catalogOnlyReply(ctx.profile);
    text = CARDS_INTRO[lang];
  }

  // Buttons: limits, right language, and defaults while facts are still missing.
  let choices = choicesInLanguage(sanitizeChoices(raw?.choices), lang);
  if (choices.length === 0 && !isProfileComplete(ctx.profile)) {
    choices = defaultChoices(ctx.profile);
  }

  // Remember what the student has now seen, so "more options" can show something new.
  const profile =
    recommended.length > 0
      ? {
          ...ctx.profile,
          seen: mergeSeen(
            ctx.profile.seen,
            recommended.map((p) => p.id),
          ),
        }
      : ctx.profile;

  return {
    language: lang,
    text,
    choices,
    programmes: recommended.map((p) => toCard(p, lang)),
    profile,
  };
}
