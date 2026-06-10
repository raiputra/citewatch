import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createXai } from "@ai-sdk/xai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { LANGUAGES, COUNTRIES, PROVIDERS, engineProvider } from "@/lib/constants";
import {
  type EngineInput,
  type EngineResult,
  resolveCredentials,
  detectCitation,
  dedupeSources,
} from "./types";
import type { Source } from "@/db/schema";

// Default models per engine — override via env without touching code.
export const MODELS = {
  chatgpt: process.env.OPENAI_MODEL ?? "gpt-5.1",
  claude: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
  gemini: process.env.GOOGLE_MODEL ?? "gemini-2.5-flash",
  grok: process.env.XAI_MODEL ?? "grok-3-latest",
  perplexity: process.env.PERPLEXITY_MODEL ?? "sonar",
} as const;

// OpenRouter slugs for the same engines. The web plugin runs the provider's
// NATIVE search for OpenAI, Anthropic, and xAI models (billed through
// OpenRouter); Gemini has no native option there and falls back to Exa
// search, with location context carried only in the prompt.
export const OPENROUTER_MODELS: Record<string, string> = {
  chatgpt: process.env.OPENROUTER_OPENAI_MODEL ?? "openai/gpt-5.1",
  claude: process.env.OPENROUTER_ANTHROPIC_MODEL ?? "anthropic/claude-sonnet-4.5",
  gemini: process.env.OPENROUTER_GOOGLE_MODEL ?? "google/gemini-2.5-flash",
  grok: process.env.OPENROUTER_XAI_MODEL ?? "x-ai/grok-3",
  perplexity: process.env.OPENROUTER_PERPLEXITY_MODEL ?? "perplexity/sonar",
};

function languageLabel(code: string) {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
function countryLabel(code: string) {
  return COUNTRIES.find((c) => c.code === code)?.label ?? code;
}

// The prompt mirrors how a real user in that locale would ask — no SEO
// framing, so the engine's organic citation behavior is preserved.
function buildPrompt(input: EngineInput) {
  return [
    `You are answering a question from a user located in ${countryLabel(input.country)}.`,
    `Answer in ${languageLabel(input.language)}.`,
    `Use web search to ground your answer in current information and cite your sources.`,
    ``,
    input.query,
  ].join("\n");
}

function extractSources(result: { sources?: unknown }): Source[] {
  const raw = (result.sources ?? []) as Array<{
    sourceType?: string;
    url?: string;
    title?: string;
  }>;
  return dedupeSources(
    raw
      .filter((s) => s.url)
      .map((s) => ({ url: s.url!, title: s.title })),
  );
}

type RunOutput = { text: string; sources: Source[]; model: string };
type DirectRunner = (input: EngineInput, key: string) => Promise<RunOutput>;

/* ─── Direct provider path: native web search ────── */

const directRunners: Record<string, DirectRunner> = {
  async chatgpt(input, key) {
    const openai = createOpenAI({ apiKey: key });
    const result = await generateText({
      model: openai(MODELS.chatgpt),
      prompt: buildPrompt(input),
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: "medium",
          userLocation: { type: "approximate", country: input.country },
        }),
      },
    });
    return { text: result.text, sources: extractSources(result), model: MODELS.chatgpt };
  },

  async claude(input, key) {
    const anthropic = createAnthropic({ apiKey: key });
    const result = await generateText({
      model: anthropic(MODELS.claude),
      prompt: buildPrompt(input),
      tools: {
        web_search: anthropic.tools.webSearch_20250305({
          maxUses: 4,
          userLocation: { type: "approximate", country: input.country },
        }),
      },
    });
    return { text: result.text, sources: extractSources(result), model: MODELS.claude };
  },

  async gemini(input, key) {
    const google = createGoogleGenerativeAI({ apiKey: key });
    const result = await generateText({
      model: google(MODELS.gemini),
      prompt: buildPrompt(input),
      tools: { google_search: google.tools.googleSearch({}) },
    });
    return { text: result.text, sources: extractSources(result), model: MODELS.gemini };
  },

  async grok(input, key) {
    const xai = createXai({ apiKey: key });
    const result = await generateText({
      model: xai(MODELS.grok),
      prompt: buildPrompt(input),
      providerOptions: {
        xai: {
          searchParameters: {
            mode: "on",
            returnCitations: true,
            maxSearchResults: 10,
            sources: [
              { type: "web", country: input.country },
              { type: "news", country: input.country },
            ],
          },
        },
      },
    });
    return { text: result.text, sources: extractSources(result), model: MODELS.grok };
  },

  async perplexity(input, key) {
    const perplexity = createPerplexity({ apiKey: key });
    const result = await generateText({
      model: perplexity(MODELS.perplexity),
      prompt: buildPrompt(input),
    });
    return { text: result.text, sources: extractSources(result), model: MODELS.perplexity };
  },
};

/* ─── OpenRouter path: one key for every engine ──── */

// Engines whose providers expose native web search through OpenRouter
const OPENROUTER_NATIVE_SEARCH = new Set(["chatgpt", "claude", "grok"]);

async function runViaOpenRouter(
  engine: string,
  input: EngineInput,
  key: string,
): Promise<RunOutput> {
  const openrouter = createOpenRouter({ apiKey: key });
  const slug = OPENROUTER_MODELS[engine];
  if (!slug) throw new Error(`No OpenRouter model configured for engine: ${engine}`);

  // Perplexity searches natively without any plugin. ChatGPT/Claude/Grok get
  // their provider's own search engine via engine:"native"; Gemini has no
  // native option on OpenRouter, so the default tiering lands on Exa.
  const searchMode =
    engine === "perplexity" ? "sonar" : OPENROUTER_NATIVE_SEARCH.has(engine) ? "native" : "exa";

  const model =
    searchMode === "sonar"
      ? openrouter.chat(slug)
      : openrouter.chat(slug, {
          plugins: [
            searchMode === "native"
              ? { id: "web", engine: "native" }
              : { id: "web", max_results: 10 },
          ],
        });

  const result = await generateText({
    model,
    prompt: buildPrompt(input),
  });
  return {
    text: result.text,
    sources: extractSources(result),
    model: `openrouter/${slug}${searchMode === "sonar" ? "" : `:${searchMode}`}`,
  };
}

export async function runLlmEngine(
  engine: string,
  input: EngineInput,
): Promise<EngineResult> {
  if (!directRunners[engine]) throw new Error(`Unknown LLM engine: ${engine}`);

  const provider = engineProvider(engine);
  const envVar = PROVIDERS.find((p) => p.id === provider)!.envVar;
  const creds = resolveCredentials(input, envVar);

  const start = Date.now();
  const { text, sources, model } =
    creds.mode === "direct"
      ? await directRunners[engine](input, creds.key)
      : await runViaOpenRouter(engine, input, creds.key);

  const { cited, mentioned } = detectCitation(sources, text, input.brandName, input.brandDomain);
  return {
    engine,
    model,
    text,
    sources,
    cited,
    mentioned,
    latencyMs: Date.now() - start,
  };
}
