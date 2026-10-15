import { MockLanguageModelV4 } from "ai/test";
import { runTurn, type ChatMessage, type ModelEntry } from "../../lib/chat";
import type { ChatResponse, Profile } from "../../lib/types";

// Types taken from the SDK's own mock, so these helpers stay correct for this SDK version.
export type StepResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
type Content = StepResult["content"][number];

const usage: StepResult["usage"] = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

// One model response.
export function step(
  content: Content[],
  finish: "tool-calls" | "stop" = "tool-calls",
): StepResult {
  return {
    content,
    finishReason: { unified: finish, raw: undefined },
    usage,
    warnings: [],
  };
}

let callCount = 0;
// A tool call made by the model.
export function call(toolName: string, input: unknown): Content {
  callCount += 1;
  return {
    type: "tool-call",
    toolCallId: `call-${callCount}`,
    toolName,
    input: JSON.stringify(input),
  };
}

// The model ends its turn with sendReply.
export function reply(
  text: string,
  choices: string[] = [],
  recommendedIds: string[] = [],
): StepResult {
  return step([call("sendReply", { text, choices, recommendedIds })]);
}

// A fake model that plays back the given steps, one per model call.
export function scriptedModel(steps: StepResult[]) {
  const mock = new MockLanguageModelV4({ doGenerate: steps });
  const entry: ModelEntry = { name: "mock", model: mock };
  return { entry, mock };
}

export type Turn = { say: string; model: StepResult[] };

// Plays a whole conversation the way the browser does:
// the history and the returned profile are carried from turn to turn.
export async function converse(
  turns: Turn[],
  start: Profile = { language: "en" },
) {
  let profile = start;
  const history: ChatMessage[] = [];
  const replies: ChatResponse[] = [];
  const mocks: MockLanguageModelV4[] = [];

  for (const turn of turns) {
    history.push({ role: "user", content: turn.say });
    const { entry, mock } = scriptedModel(turn.model);
    const answer = await runTurn([...history], profile, [entry]);
    replies.push(answer);
    mocks.push(mock);
    profile = answer.profile;
    history.push({ role: "assistant", content: answer.text });
  }
  return { replies, mocks, profile };
}
