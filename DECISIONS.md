# Decisions

## What I read

- **AI SDK docs (ai-sdk.dev):** Tool Calling, Loop Control (`stopWhen`, `hasToolCall`) and Testing (`MockLanguageModelV4`). I used my AI assistant to find and check these pages against the version I had installed (v7), because AI tools often suggest code from older SDK versions.
- **Gemini models list endpoint:** queried with my own key to see which models I could actually use, after `gemini-flash-latest` returned 403.
- **Groq console (Playground and Models):** to pick model IDs that support tool use.

## Main choices

1. **Trust nothing the model sends.** Options: rely on the prompt, on structured output, or check everything on the server. I picked one server gate, `guardReply`, that every reply passes and that can only return a valid reply or a safe fallback.
2. **Non-streaming (`generateText`).** Streaming feels faster, but the student would see text before it is checked.
3. **Final reply through a `sendReply` tool, recommendations by ID.** A reply tool works the same across providers and gives one place to validate. The server builds the cards from the catalog.
4. **`toolChoice: "auto"` plus salvage.** With `"required"`, Groq rejected the whole turn when the model answered in text. Plain-text answers are now parsed back into a reply, still fully guarded.
5. **Loose tool schemas, strict code.** A strict enum made the provider reject "finance" and crash the turn. Schemas accept strings; code validates them and tells the model what was wrong.
6. **Atomic model attempts, deterministic capture.** A failed model attempt could leave half-saved facts, so each attempt works on its own copy. Separately, the server captures the answer to the question it asked in code, so a model that forgets `saveFact` never loses what the student said.
7. **Recommendations are decided by code.** In testing, the model recommended a course needing IELTS 6.5 to a student with 5.5, and a "helpful" guard attached unrelated programmes. Now only programmes matching every saved fact can be shown (or, if none match, the 3 closest, labelled with what doesn't fit). Whenever the server changes the cards, it writes the text too.
8. **Buttons must answer the message.** Generic default buttons once appeared under a question they didn't answer. The server now detects what a question is about and attaches matching buttons, Yes/No for yes/no questions, and none rather than wrong ones.
9. **Models.** Gemini's free tier was overloaded (503), so I added Groq and a fallback list. Qwen 3.8 was about 3x faster but skipped the tools on most turns; `gpt-oss-120b` used them reliably.
10. **Stateless server.** The profile lives in the browser and is validated with Zod each request. Trade-off: a client can edit it, but every reply is still guarded.
11. **Currencies and "no match".** Seven currencies are compared in QAR with fixed approximate rates. When nothing fits, the closest options are ranked: different field worst, then English level, then how far over budget.
12. **Security: harder and harmless.** A narrow injection filter (a false alarm blocks a real student; a miss is still caught by the output guards), prompt rules, read-only tools, output guards, rate limit, headers, and a secret scan in CI.
13. **A queue for busy moments.** Many students at once would mean many simultaneous model calls that hit rate limits together. Turns run a few at a time, wait in line, and get a clear "busy" reply if the line is full. It is in-memory (per instance); production would use a shared queue.

## With more time

- Streaming with buffered, guarded chunks
- Server-side sessions instead of trusting browser-sent history and profile
- A shared store (e.g. Redis) for the rate limit and queue, and a Content-Security-Policy with nonces
- Live exchange rates, and translated host names in Arabic
- An evaluation set of recorded conversations to compare models and prompts automatically
