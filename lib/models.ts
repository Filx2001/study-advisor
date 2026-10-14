import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { ModelEntry } from "./chat";

// Models to try in order, as "provider:model". If one fails, the next is tried.
// Providers without an API key are skipped, so the app runs with either key alone.
const MODEL_LIST = (
  process.env.AI_MODELS ??
  "groq:openai/gpt-oss-120b,google:gemini-3.5-flash,google:gemini-3.1-flash-lite"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

export function availableModels(): ModelEntry[] {
  return MODEL_LIST.flatMap((entry): ModelEntry[] => {
    const i = entry.indexOf(":");
    const provider = i === -1 ? "google" : entry.slice(0, i);
    const id = i === -1 ? entry : entry.slice(i + 1);
    if (provider === "groq" && process.env.GROQ_API_KEY)
      return [{ name: entry, model: groq(id) }];
    if (provider === "google" && process.env.GOOGLE_GENERATIVE_AI_API_KEY)
      return [{ name: entry, model: google(id) }];
    return [];
  });
}
