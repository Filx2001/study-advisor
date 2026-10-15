import { catalog, getById } from "./catalog";
import { arabicRatio, matchesLanguage } from "./language";
import { stripLinks, leaksPrompt } from "./security";
import {
  eligibleFor,
  recommendationText,
  allShownText,
  PREFERENCE_CHOICES,
  type Candidate,
} from "./recommend";
import {
  fallbackReply,
  missingFactReply,
  catalogOnlyReply,
  CARDS_INTRO,
} from "./fallback";
import {
  choicesFor,
  detectQuestionTopic,
  isYesNoQuestion,
  YES_NO,
  type Awaiting,
} from "./questions";
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
    if (/\bP\d{2}\b/i.test(choice)) continue; // internal programme codes never appear on buttons
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

function candidateCard(c: Candidate, lang: Language): ProgrammeCard {
  return c.misses.length > 0
    ? { ...toCard(c.program, lang), misses: c.misses }
    : toCard(c.program, lang);
}

// Programme ids the student has already been shown (kept in the profile, newest last).
export function mergeSeen(seen: string[] | undefined, ids: string[]): string[] {
  return [...new Set([...(seen ?? []), ...ids])].slice(-MAX_SEEN);
}

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(ids)];
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

  // ----- Recommendations: decided by code from the saved facts, never by the model alone -----
  const requested = normalizeIds(raw?.recommendedIds);
  const triedToRecommend = requested.length > 0;
  let cards: Candidate[] = [];
  let serverDecided = false; // when true, the server writes the text so it always matches the cards

  if (!isProfileComplete(ctx.profile)) {
    // Ask before recommending: no cards until every fact is known.
    if (triedToRecommend) return missingFactReply(ctx.profile);
  } else {
    const eligible = eligibleFor(ctx.profile);
    const byId = new Map(eligible.candidates.map((c) => [c.program.id, c]));
    const seen = new Set(ctx.profile.seen ?? []);
    const unseen = eligible.candidates.filter((c) => !seen.has(c.program.id));

    if (triedToRecommend) {
      // Keep only what matches the saved facts (or, if nothing does, the closest).
      // The catalog and the saved facts decide, so a fitting programme can be shown again when asked about.
      const kept = requested.flatMap((id) => {
        const c = byId.get(id);
        return c ? [c] : [];
      });
      if (
        kept.length === requested.length &&
        kept.length <= MAX_RECOMMENDATIONS
      ) {
        cards = kept; // everything the model chose is valid: keep its text too
      } else {
        // Something was invalid: the model's text can't be trusted to match. The server decides.
        serverDecided = true;
        cards = (kept.length > 0 ? kept : unseen).slice(0, MAX_RECOMMENDATIONS);
        text =
          cards.length > 0
            ? recommendationText(eligible.kind, cards.length, lang)
            : allShownText(lang);
      }
    } else if (ctx.allowedIds.size > 0 && unseen.length > 0) {
      // The model searched but attached nothing, and there are matching programmes the student hasn't seen.
      serverDecided = true;
      cards = unseen.slice(0, MAX_RECOMMENDATIONS);
      text = recommendationText(eligible.kind, cards.length, lang);
    }
  }

  // The model's text names an institution that isn't in the catalog: don't show it.
  if (!serverDecided && mentionsUnknownInstitution(text)) {
    if (cards.length === 0) return catalogOnlyReply(ctx.profile);
    text = CARDS_INTRO[lang];
  }

  // ----- Buttons: they must answer the message they are under -----
  let choices: string[] = [];
  let awaiting: Awaiting | undefined;

  if (serverDecided) {
    choices = [...PREFERENCE_CHOICES[lang]]; // the server's text is a statement about the cards
  } else {
    const asks = /[?؟]/.test(text);
    const topic = asks ? detectQuestionTopic(text) : undefined;
    const modelChoices = choicesInLanguage(sanitizeChoices(raw?.choices), lang);

    if (topic) {
      // The question is about a known fact: the server's buttons answer exactly that question.
      choices = choicesFor(topic, ctx.profile);
      awaiting = topic;
    } else if (modelChoices.length > 0) {
      choices = modelChoices;
      awaiting = asks ? "other" : undefined;
    } else if (!isProfileComplete(ctx.profile)) {
      // Facts are missing and the model gave no usable buttons: the server asks the next question itself,
      // question AND buttons together. A plain statement from the model is kept in front.
      const ask = missingFactReply(ctx.profile);
      const statement = asks ? "" : text;
      return {
        ...ask,
        text: statement ? `${statement} ${ask.text}` : ask.text,
      };
    } else if (asks) {
      // A question we can't classify: Yes/No if it is a yes/no question, otherwise no buttons rather than wrong ones.
      choices = isYesNoQuestion(text) ? [...YES_NO[lang]] : [];
      awaiting = "other";
    } else {
      choices = [...PREFERENCE_CHOICES[lang]]; // after a statement, offer the next actions
    }
  }

  // Remember what the student has now seen, and what this message asked.
  const profile: Profile = {
    ...ctx.profile,
    awaiting,
    ...(cards.length > 0
      ? {
          seen: mergeSeen(
            ctx.profile.seen,
            cards.map((c) => c.program.id),
          ),
        }
      : {}),
  };

  return {
    language: lang,
    text,
    choices,
    programmes: cards.map((c) => candidateCard(c, lang)),
    profile,
  };
}
