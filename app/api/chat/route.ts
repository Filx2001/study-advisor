import { z } from "zod";
import { ProfileSchema } from "@/lib/schema";
import { runTurn } from "@/lib/chat";
import { availableModels } from "@/lib/models";
import { allowRequest } from "@/lib/rate-limit";
import { rateLimitReply } from "@/lib/security";
import { detectLanguage } from "@/lib/language";
import { chatQueue, busyReply, QueueBusyError } from "@/lib/queue";

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

// Best-effort client id for rate limiting. Headers can be spoofed;
// a production deployment would rely on the platform's verified client IP.
function clientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export async function POST(req: Request) {
  // Validate the request: it comes from the browser, so it is untrusted.
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
  const language = detectLanguage(last.content, profile.language);

  // Per-user rate limit: protects the API key's quota from one abusive client.
  if (!allowRequest(clientKey(req))) {
    return Response.json(rateLimitReply({ ...profile, language }), {
      status: 429,
    });
  }

  // Global queue: at most a few turns call the model at once; the rest wait their turn.
  try {
    const reply = await chatQueue.run(() =>
      runTurn(messages, profile, availableModels()),
    );
    return Response.json(reply);
  } catch (error) {
    if (error instanceof QueueBusyError) {
      console.warn(`[chat] queue ${error.reason}:`, chatQueue.stats);
      return Response.json(busyReply({ ...profile, language }), {
        status: 503,
      });
    }
    throw error;
  }
}
