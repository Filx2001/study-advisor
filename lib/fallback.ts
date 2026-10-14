import type { ChatResponse, Profile } from "./types";

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
