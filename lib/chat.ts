import { generateText, hasToolCall, stepCountIs, type LanguageModel } from "ai";
import { detectLanguage } from "./language";
import { buildPrompt } from "./prompt";
import { createTools, type TurnContext } from "./tools";
import { guardReply } from "./guards";
import { fallbackReply } from "./fallback";
import { salvagePlainText } from "./salvage";
import { sanitizeInput, looksLikeInjection, injectionReply } from "./security";
import { captureAnswer } from "./capture";
import { detectChangeRequest, changeReply } from "./questions";
import type { ChatResponse, Profile } from "./types";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ModelEntry = { name: string; model: LanguageModel };

const ATTEMPT_TIMEOUT_MS = 15_000; // max time for one model
const TOTAL_TIMEOUT_MS = 30_000; // max time for the whole turn, across all models
const HISTORY_LIMIT = 20;
const MAX_ASSISTANT_CHARS = 1_000;

// One chat turn: input checks → capture the expected answer → model with tools → output guards.
// Models are passed in, so tests can run the whole pipeline without a real model.
export async function runTurn(
  messages: ChatMessage[],
  profile: Profile,
  models: ModelEntry[],
): Promise<ChatResponse> {
  const input = sanitizeInput(messages[messages.length - 1]?.content ?? "");
  const languageProfile: Profile = {
    ...profile,
    language: detectLanguage(input, profile.language),
  };

  if (!input) return fallbackReply(languageProfile);

  // 1. Obvious prompt-injection attempts get a polite server reply; the model never sees them.
  if (looksLikeInjection(input)) {
    console.warn("[chat] blocked a likely prompt-injection attempt");
    return injectionReply(languageProfile);
  }
  // 1b. Taps on the server's own buttons ("Change field", "Change budget") are answered in code.
  const change = detectChangeRequest(input);
  if (change) return changeReply(languageProfile, change);
  // 2. Save the answer to the question we were waiting for, in code, before the model runs.
  //    The model then sees it as known; if it forgets saveFact, nothing is lost.
  const baseProfile = captureAnswer(languageProfile, input);

  // The history comes from the browser, so it is untrusted too:
  // clean it, cap bot messages, and neutralise earlier injection attempts.
  const recent: ChatMessage[] = messages
    .slice(-HISTORY_LIMIT, -1)
    .map((m): ChatMessage => {
      if (m.role === "assistant")
        return {
          role: "assistant",
          content: m.content.slice(0, MAX_ASSISTANT_CHARS),
        };
      const clean = sanitizeInput(m.content);
      return {
        role: "user",
        content: looksLikeInjection(clean) ? "(message removed)" : clean,
      };
    });
  recent.push({ role: "user", content: input });
  while (recent[0].role !== "user") recent.shift();

  // 3. Try each model until one produces a reply. Each attempt gets a fresh context,
  //    so a failed attempt leaves nothing behind: a turn fully succeeds or changes nothing.
  let ctx: TurnContext = { profile: baseProfile, allowedIds: new Set() };
  const started = Date.now();

  for (const { name, model } of models) {
    const remaining = TOTAL_TIMEOUT_MS - (Date.now() - started);
    if (remaining < 2_000) {
      console.warn("[chat] time budget used up, skipping remaining models");
      break;
    }

    const attempt: TurnContext = {
      profile: { ...baseProfile },
      allowedIds: new Set(),
    };
    try {
      const result = await generateText({
        model,
        system: buildPrompt(attempt.profile),
        messages: recent,
        tools: createTools(attempt),
        toolChoice: "auto", // "required" made providers reject the whole turn when the model slipped
        stopWhen: [hasToolCall("sendReply"), stepCountIs(6)],
        maxRetries: 0, // no waiting on a failing model: the next model in the list is the retry
        abortSignal: AbortSignal.timeout(
          Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        ),
      });
      const calls = result.steps.flatMap((s) =>
        s.toolCalls.map((c) => c.toolName),
      );
      console.log(`[chat] ${name}: ${calls.join(" → ") || "(no tools)"}`);

      // Plain-text answer instead of sendReply: recover what we can (still guarded below).
      if (!attempt.reply && result.text.trim()) {
        attempt.reply = salvagePlainText(result.text);
        console.log(`[chat] ${name}: plain-text reply salvaged`);
      }

      if (attempt.reply) {
        ctx = attempt;
        break;
      }
    } catch (error) {
      console.error(
        `[chat] ${name} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 4. Every path ends here: guards fix the reply or fall back.
  return guardReply(ctx.reply, ctx);
}
