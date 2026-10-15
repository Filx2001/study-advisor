# AI usage

## Tools and what I used them for

- **Claude (Anthropic):** my main assistant. Planning and architecture, almost all of the code and tests, and debugging from my own test runs, server logs and screenshots.
- **Qwen:** an alternative plan at the start, which I compared with Claude's.
- **A second AI assistant:** reviewed the combined plan; it suggested ending each turn with a `sendReply` tool, which I adopted.

## One thing the AI got wrong, and how I noticed

Qwen's plan said `catalog.json` had extra spaces in its keys and values (`"id "`, `"P01 "`) and called fixing this "critical". The second AI review then repeated the claim, even more confidently. I opened the file and the keys were clean. To prove it, the catalog now loads through a strict Zod schema with a test; it passed on the first run, so the problem never existed.

Other AI mistakes I caught by testing:

- Claude added a guard that attached programmes the model "forgot". In the browser it showed unrelated programmes under a reply saying nothing new was left. I pushed for a strict rule instead: only programmes matching every saved fact, and server-written text whenever the server changes the cards.
- Claude's default buttons appeared under questions they didn't answer (budget buttons under an IELTS question, "Change budget" under "which new field?"). Buttons now come from what the question is actually about.
- Claude suggested the `gemini-flash-latest` alias, which returned 403 on my free-tier key.
- Claude's first `saveFact` schema used a strict enum, so "finance" made Groq reject the whole tool call. I saw it in the server logs.
- `toolChoice: "required"` made whole turns fail when the model answered in text.
- A test used `as any`, which ESLint flagged.
- Qwen's plan used an outdated AI SDK function name (`toDataStreamResponse`).

## What I did myself

I didn't hand-write most of the code. My part was directing, testing and integrating it:

- **Tested every step** in the terminal and the browser, and found the bugs that shaped the design: replies promising programmes but showing none, a course recommended to a student who didn't qualify, the same programme repeated for "more options", unrelated cards under a reply, buttons that didn't match the question, the bot forgetting answers it claimed to save, and raw markdown in replies.
- **Insisted the safety layer be strict and deterministic** after those findings, rather than accepting "usually works".
- **Picked the model by experiment** (Gemini, Groq Qwen, Groq gpt-oss), using the server logs to see which one actually called the tools.
- **Chose the UI design** from a mockup, required it to be responsive on every screen, and decided what to drop (no invented universities, photos or dates).
- **Asked for the security layers, the queue, CI, and automated browser tests** instead of a manual checklist.
- **Fixed setup and integration problems:** packages installed in the wrong folder, a `@types/node` conflict with Vitest (upgraded the types rather than forcing the install), `.gitignore` hiding `.env.example`, and edits that hadn't been saved to disk. Browser tests caught one of those: a busy-server message that only existed in my editor.
