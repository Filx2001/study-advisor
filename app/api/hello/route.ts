import { generateText, tool, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export async function GET() {
  const result = await generateText({
    model: google("gemini-3.5-flash"),
    prompt: "Which summer programmes are in Qatar? Use the tool.",
    tools: {
      programmesByCountry: tool({
        description: "Return the summer programmes hosted in a given country.",
        inputSchema: z.object({ country: z.string() }),
        execute: async ({ country }) => {
          console.log("TOOL CALLED with:", country);
          return country.toLowerCase() === "qatar"
            ? [
                "Arabic Creative Writing",
                "Pre-Med Biology Bootcamp",
                "Islamic Art & Calligraphy",
              ]
            : [];
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return Response.json({ text: result.text, steps: result.steps.length });
}
