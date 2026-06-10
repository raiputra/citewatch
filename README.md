# Citewatch

Open-source brand citation tracking across AI answer engines. Ask the questions
your customers ask — in their language, from their location — and see whether
**ChatGPT, Claude, Gemini, Grok, Perplexity, and Google AI Overviews** cite or
mention your brand.

Built for AI SEO / GEO (generative engine optimization) agencies and in-house
marketing teams.

## How it works

- **Genuine retrieval, not hallucinated answers.** Every LLM engine is queried
  through its native web-search capability via the
  [AI SDK](https://ai-sdk.dev): OpenAI web search, Anthropic web search,
  Gemini Google Search grounding, xAI Live Search, and Perplexity Sonar
  (search-native). Citations come from the engine's actual `sources`.
- **One key or many.** Run everything through a single
  [OpenRouter](https://openrouter.ai) key (`OPENROUTER_API_KEY`), or set
  direct provider keys (which take precedence per engine). Even via
  OpenRouter, ChatGPT, Claude, and Grok use their provider's **native** web
  search; Perplexity searches natively by design. Only Gemini falls back to
  OpenRouter's Exa-powered web plugin. Direct keys remain slightly cheaper
  and add geo-targeted search (`userLocation`/country parameters).
- **Multi-language & geo-targeted.** Prompts carry a language and a country.
  Search tools receive the user location, and Google AI Overview capture uses
  `hl`/`gl` parameters.
- **AI Overview capture.** A headless Chromium scrape
  (`playwright-core` + `@sparticuz/chromium`) loads the localized SERP, then
  ChatGPT extracts the AI Overview text and its cited sources as structured
  output — no SERP API subscription required. Best-effort, since Google
  rate-limits datacenter IPs.
- **Citation vs mention.** A run is *cited* when the brand domain appears in
  the answer's sources, and *mentioned* when the brand name appears in the
  answer text.

## Product rules

- Sign in with **Google OAuth** only.
- Users must provide **company, industry, and size** before the workspace
  unlocks.
- Every account gets **12 free credits**; one engine-check costs one credit.
- **Bring your own keys** (Settings → API keys) and checks for that provider
  are free. Keys are encrypted at rest with AES-256-GCM.

## Stack

Next.js (App Router) · Better Auth · Drizzle ORM · Neon Postgres · AI SDK v6 ·
Tailwind v4 · deployed on Vercel.

## Local development

```bash
git clone https://github.com/raiputra/citewatch
cd citewatch
npm install
cp .env.example .env  # fill it in
npm run db:push       # create tables
npm run dev
```

### Required environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres (Neon recommended) |
| `BETTER_AUTH_SECRET` | Session signing — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | App origin, e.g. `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth (redirect URI `/api/auth/callback/google`) |
| `ENCRYPTION_KEY` | BYOK encryption at rest (optional, falls back to auth secret) |
| `OPENROUTER_API_KEY` | One key for all engines (optional if direct keys are set) |
| `OPENAI_API_KEY` … `PERPLEXITY_API_KEY` | Direct provider keys; take precedence over OpenRouter per engine. The OpenAI key also powers AI Overview extraction |

## Deploying to Vercel

1. Create a Neon database (Vercel Marketplace) and set `DATABASE_URL`.
2. Set the env vars above (`BETTER_AUTH_URL` = your production URL).
3. Add the production redirect URI to your Google OAuth client.
4. `npm run db:push` against the production database (or wire up migrations).
5. Deploy. The run endpoint sets `maxDuration = 300` for the engine fan-out.

## License

MIT
