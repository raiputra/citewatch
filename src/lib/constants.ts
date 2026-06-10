export const ENGINES = [
  { id: "chatgpt", label: "ChatGPT", provider: "openai" },
  { id: "claude", label: "Claude", provider: "anthropic" },
  { id: "gemini", label: "Gemini", provider: "google" },
  { id: "grok", label: "Grok", provider: "xai" },
  { id: "perplexity", label: "Perplexity", provider: "perplexity" },
  // Headless SERP scrape + GPT extraction — OpenAI key powers the extraction
  { id: "ai-overview", label: "Google AI Overview", provider: "openai" },
] as const;

export type EngineId = (typeof ENGINES)[number]["id"];
export type ProviderId = (typeof ENGINES)[number]["provider"] | "openrouter";

export const PROVIDERS: { id: ProviderId; label: string; envVar: string }[] = [
  // One key that covers every engine. Direct provider keys take precedence
  // because they're cheaper and use the engine's native web search.
  { id: "openrouter", label: "OpenRouter (one key, all engines)", envVar: "OPENROUTER_API_KEY" },
  { id: "openai", label: "OpenAI (ChatGPT)", envVar: "OPENAI_API_KEY" },
  { id: "anthropic", label: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY" },
  { id: "google", label: "Google (Gemini)", envVar: "GOOGLE_GENERATIVE_AI_API_KEY" },
  { id: "xai", label: "xAI (Grok)", envVar: "XAI_API_KEY" },
  { id: "perplexity", label: "Perplexity", envVar: "PERPLEXITY_API_KEY" },
];

export function engineProvider(engine: string): ProviderId {
  const e = ENGINES.find((e) => e.id === engine);
  if (!e) throw new Error(`Unknown engine: ${engine}`);
  return e.provider;
}

export function engineLabel(engine: string): string {
  return ENGINES.find((e) => e.id === engine)?.label ?? engine;
}

export const INDUSTRIES = [
  "SaaS / Software",
  "E-commerce / Retail",
  "Agency / Consulting",
  "Finance / Insurance",
  "Healthcare",
  "Education",
  "Travel / Hospitality",
  "Real Estate",
  "Media / Publishing",
  "Manufacturing",
  "Legal",
  "Other",
];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "id", label: "Indonesian" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ms", label: "Malay" },
];

export const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "ID", label: "Indonesia" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
  { code: "CN", label: "China" },
  { code: "IN", label: "India" },
  { code: "SG", label: "Singapore" },
  { code: "MY", label: "Malaysia" },
  { code: "TH", label: "Thailand" },
  { code: "VN", label: "Vietnam" },
  { code: "PH", label: "Philippines" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "TR", label: "Turkey" },
  { code: "RU", label: "Russia" },
];

export const FREE_CREDITS = 12;

export const CREDIT_VOLUMES = ["~50", "~200", "~500", "1000+"];
