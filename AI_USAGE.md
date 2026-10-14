# AI usage

## Tools and what I used them for

- **Claude (Anthropic):** my main assistant. Planning and architecture, almost all of the code and tests, and debugging from my own test runs, server logs and screenshots.
- **Qwen:** an alternative plan at the start, which I compared with Claude's.
- **A second AI assistant:** reviewed the combined plan; it suggested ending each turn with a `sendReply` tool, which I adopted.

## One thing the AI got wrong, and how I noticed

Qwen's plan said `catalog.json` had extra spaces in its keys and values (`"id "`, `"P01 "`) and called fixing this "critical". The second AI review then repeated the claim, even more confidently. I opened the file and the keys were clean. To prove it, the catalog now loads through a strict Zod schema with a test; it passed on the first run, so the problem never existed.

Other AI mistakes I caught by testing:

- Claude suggested the `gemini-flash-latest` alias, which returned 403 on my free-tier key. I listed the models my key could use and switched to pinned, configurable models.
- Claude's first `saveFact` schema used a strict enum, so "finance" made Groq reject the whole tool call. I saw it in the server logs; validation moved into code.
- `toolChoice: "required"` made whole turns fail when the model answered in text.
- A test used `as any`, which ESLint flagged; it was replaced with a type taken from the tools.
- Qwen's plan used an outdated AI SDK function name (`toDataStreamResponse`).

## What I did myself

I didn't hand-write most of the code. My part was directing, testing and integrating it:

- **Tested every step** in the terminal and the browser, and found the bugs that shaped the design: replies that promised programmes but showed none, no recommendations when nothing matched exactly, the bot asking again about things it already knew, raw markdown in replies, and the half-saved facts after a failed model call.
- **Picked the model by experiment** (Gemini, Groq Qwen, Groq gpt-oss), using the server logs to see which one actually called the tools.
- **Chose the UI design** from a mockup, asked for it to be responsive, and decided what to keep and drop (no invented universities, photos or dates).
- **Asked for the security layers and the CI pipeline**, beyond the task's requirements.
- **Fixed setup and integration problems:** packages installed in the wrong folder, a `@types/node` conflict with Vitest (upgraded the types rather than forcing the install), `.gitignore` hiding `.env.example`, and edits that were only partly applied, which I caught because the test count was lower than expected.
