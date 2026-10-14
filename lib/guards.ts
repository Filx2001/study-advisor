import { getById } from "./catalog";
import { matchesLanguage } from "./language";
import { fallbackReply } from "./fallback";
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

// ---------- Text ----------

// Remove internal programme codes (students should never see "P08"),
// tidy spacing, and cap the length.
export function cleanText(text: string): string {
  const cleaned = text
    .replace(/\bP\d{2}\b/gi, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?،؟])/g, "$1")
    .trim();
  return [...cleaned].slice(0, MAX_TEXT_LENGTH).join("");
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
  const text = typeof raw?.text === "string" ? cleanText(raw.text) : "";

  if (!text || !matchesLanguage(text, lang)) return fallbackReply(ctx.profile);

  return {
    language: lang,
    text,
    choices: sanitizeChoices(raw?.choices),
    programmes: filterRecommendations(
      raw?.recommendedIds,
      ctx.allowedIds,
      ctx.profile,
    ).map((p) => toCard(p, lang)),
    profile: ctx.profile,
  };
}
