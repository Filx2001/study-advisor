# Decisions

## What I read

- **AI SDK docs (ai-sdk.dev):** Tool Calling, Loop Control (`stopWhen`, `hasToolCall`) and Testing (`MockLanguageModelV4`). I used my AI assistant to find and check these pages against the version I had installed (v7), because AI tools often suggest code from older SDK versions.
- **Gemini models list endpoint:** I queried it with my own key to see which models I could actually use, after `gemini-flash-latest` returned 403.
- **Groq console (Playground and Models):** to pick model IDs that support tool use.

## Main choices

1. **Trust nothing the model sends.** Options: rely on the prompt, rely on structured output, or check everything on the server. I picked a single server gate, `guardReply`, that every reply passes through and that can only return a valid reply or a safe fallback, because the task says the rules must hold when the model misbehaves.
2. **Non-streaming (`generateText`).** Streaming feels faster, but the student would see text before it is checked. I chose to guard the full reply first.
3. **Final reply through a `sendReply` tool, recommendations by ID.** Options: free text, structured output, or a reply tool. A tool works the same across providers and gives one place to validate. An ID must exist in the catalog _and_ have been returned by `searchCatalog` in the same turn; the server builds the cards.
4. **`toolChoice: "auto"` plus salvage, not `"required"`.** With `"required"`, Groq rejected the whole turn when the model answered in text. Now plain-text answers are parsed back into a reply, which is still fully guarded.
5. **Loose tool schemas, strict code.** A strict enum for `interest` made the provider reject the call when the model sent "finance", which crashed the turn. Schemas now accept strings, and `applyFact` validates them and returns a rejection message the model can act on.
6. **Atomic turns.** Testing showed a failed model attempt could leave half-saved facts. Each attempt now works on its own copy; only a successful attempt is kept.
7. **Models.** Gemini's free tier was overloaded (503) or closed to new users for some models, so I added Groq and a fallback list (`AI_MODELS`). On Groq, Qwen 3.8 answered about 3x faster but skipped the tools on most turns; `gpt-oss-120b` used them reliably, so it goes first.
8. **Stateless server.** The profile lives in the browser and is validated with Zod on every request. No database is needed. Trade-off: a client can edit it, but every reply is still guarded.
9. **Currencies and "no match".** The catalog uses seven currencies, so prices are compared in QAR with fixed approximate rates. When nothing fits, the bot shows the closest real programmes, ranked so a different field counts most, then English level, then how far over budget.
10. **Security: harder and harmless.** A deliberately narrow injection filter (a false alarm blocks a real student; a miss is still caught by the output guards), prompt rules, read-only tools, output guards, a rate limit, security headers, and a secret scan in CI.

## With more time

- Streaming with buffered, guarded chunks
- Server-side sessions instead of trusting browser-sent history and profile
- A shared rate-limit store (e.g. Redis) and a Content-Security-Policy with nonces
- Live exchange rates
- An evaluation set of recorded conversations to compare models and prompts automatically
- Arabic-Indic digits (٣٠٠٠), translated host names, and better Arabic plural forms
