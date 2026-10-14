import { generateText, hasToolCall, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { ProfileSchema } from "@/lib/schema";
import { detectLanguage } from "@/lib/language";
import { buildPrompt } from "@/lib/prompt";
import { createTools, type TurnContext } from "@/lib/tools";
import { guardReply } from "@/lib/guards";
import { salvagePlainText } from "@/lib/salvage";
import type { Profile } from "@/lib/types";

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .min(1)
    .max(60),
  profile: ProfileSchema.default({ language: "en" }),
});

// Models to try in order, as "provider:model". If one fails, the next is tried.
// Providers without an API key are skipped, so the app runs with either key alone.
const MODEL_LIST = (
  process.env.AI_MODELS ??
  "groq:openai/gpt-oss-120b,google:gemini-3.1-flash-lite,google:gemini-3.5-flash"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const ATTEMPT_TIMEOUT_MS = 20_000;

function availableModels() {
  return MODEL_LIST.flatMap((entry) => {
    const i = entry.indexOf(":");
    const provider = i === -1 ? "google" : entry.slice(0, i);
    const id = i === -1 ? entry : entry.slice(i + 1);
    if (provider === "groq" && process.env.GROQ_API_KEY)
      return [{ entry, model: groq(id) }];
    if (provider === "google" && process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      return [{ entry, model: google(id) }];
    return [];
  });
}

export async function POST(req: Request) {
  // 1. Validate the request (it comes from the browser, so it is untrusted).
  const parsed = ChatRequestSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { messages, profile } = parsed.data;
  const last = messages[messages.length - 1];
  if (last.role !== "user" || !last.content.trim()) {
    return Response.json(
      { error: "Last message must be a non-empty user message" },
      { status: 400 },
    );
  }

  // 2. The server decides the reply language, not the model.
  const baseProfile: Profile = {
    ...profile,
    language: detectLanguage(last.content, profile.language),
  };

  // 3. Keep recent history, starting with a user message.
  const recent = messages.slice(-20);
  while (recent[0].role !== "user") recent.shift();

  // 4. Try each model until one produces a reply.
  //    Each attempt gets a fresh context, so a failed attempt leaves nothing behind
  //    (no half-saved facts): a turn either fully succeeds or changes nothing.
  let ctx: TurnContext = { profile: baseProfile, allowedIds: new Set() };

  for (const { entry, model } of availableModels()) {
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
        maxRetries: 1, // fail fast and move to the next model
        abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      const calls = result.steps.flatMap((s) =>
        s.toolCalls.map((c) => c.toolName),
      );
      console.log(`[chat] ${entry}: ${calls.join(" → ") || "(no tools)"}`);

      // The model answered in plain text instead of calling sendReply:
      // recover what we can. It is still untrusted and goes through every guard.
      if (!attempt.reply && result.text.trim()) {
        attempt.reply = salvagePlainText(result.text);
        console.log(`[chat] ${entry}: plain-text reply salvaged`);
      }

      if (attempt.reply) {
        ctx = attempt; // success: keep this attempt's results
        break;
      }
    } catch (error) {
      console.error(
        `[chat] ${entry} failed:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 5. Every path ends here: guards fix the reply or fall back.
  return Response.json(guardReply(ctx.reply, ctx));
}
