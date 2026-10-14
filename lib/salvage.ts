import type { RawReply } from "./guards";

// Some models write the sendReply payload as plain text instead of calling the tool.
// Recover it as an untrusted reply; it still goes through guardReply like everything else.
export function salvagePlainText(raw: string): RawReply {
  const text = raw.trim();

  // 1. A JSON object with a "text" field somewhere in the answer.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      if (obj && typeof obj.text === "string") {
        return {
          text: obj.text,
          choices: obj.choices,
          recommendedIds: obj.recommendedIds,
        };
      }
    } catch {
      // Not valid JSON: try the next strategy.
    }
  }

  // 2. A "Choices:" header followed by a bullet list.
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex((l) =>
    /^\s*(choices|buttons|options|الخيارات|خيارات)\s*:?\s*$/i.test(l),
  );
  if (header !== -1) {
    const choices = lines
      .slice(header + 1)
      .map((l) => l.match(/^\s*[-*•]\s+(.+)$/)?.[1]?.trim())
      .filter((c): c is string => Boolean(c));
    return {
      text: lines.slice(0, header).join("\n").trim(),
      choices,
      recommendedIds: [],
    };
  }

  // 3. Just text.
  return { text, choices: [], recommendedIds: [] };
}
