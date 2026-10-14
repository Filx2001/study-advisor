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

  // 2. "Choices:" followed by a JSON array on the same line, e.g.  Choices: ["Yes", "No"]
  const inline = text.match(
    /(choices|buttons|options|الخيارات|خيارات)\s*:\s*(\[[^\]]*\])/i,
  );
  if (inline && inline.index !== undefined) {
    try {
      const choices = JSON.parse(inline[2]);
      return {
        text: removeRepeat(text.slice(0, inline.index)),
        choices,
        recommendedIds: [],
      };
    } catch {
      // Not a valid array: try the next strategy.
    }
  }

  // 3. A "Choices:" header line followed by a bullet list.
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
      text: removeRepeat(lines.slice(0, header).join("\n")),
      choices,
      recommendedIds: [],
    };
  }

  // 4. Just text.
  return { text: removeRepeat(text), choices: [], recommendedIds: [] };
}

// Models sometimes write the same text twice in a row; keep one copy.
export function removeRepeat(text: string): string {
  const t = text.trim();
  const match = t.match(/^([\s\S]+?)\s*\1$/);
  return match ? match[1].trim() : t;
}
