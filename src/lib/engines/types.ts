import type { Source } from "@/db/schema";

export type EngineInput = {
  query: string;
  language: string; // ISO 639-1
  country: string; // ISO 3166-1 alpha-2
  brandName: string;
  brandDomain: string;
  // BYOK. Resolution order per engine: user direct key → user OpenRouter
  // key → platform direct env key → platform OPENROUTER_API_KEY.
  directKey?: string;
  openrouterKey?: string;
};

export type ResolvedCredentials =
  | { mode: "direct"; key: string }
  | { mode: "openrouter"; key: string };

export function resolveCredentials(
  input: Pick<EngineInput, "directKey" | "openrouterKey">,
  envVar: string,
): ResolvedCredentials {
  if (input.directKey) return { mode: "direct", key: input.directKey };
  if (input.openrouterKey) return { mode: "openrouter", key: input.openrouterKey };
  const direct = process.env[envVar];
  if (direct) return { mode: "direct", key: direct };
  const openrouter = process.env.OPENROUTER_API_KEY;
  if (openrouter) return { mode: "openrouter", key: openrouter };
  throw new Error("No API key available for this engine.");
}

export type EngineResult = {
  engine: string;
  model?: string;
  text: string;
  sources: Source[];
  cited: boolean;
  mentioned: boolean;
  latencyMs: number;
};

/**
 * Canonicalizes user-entered domains: strips protocol, credentials, port,
 * path, query, leading www., and trailing dots; lowercases. Returns "" when
 * the input can't be parsed as a host.
 *   "https://www.Acme.com/about?x=1" → "acme.com"
 *   "blog.acme.co.id:8080"           → "blog.acme.co.id"
 */
export function normalizeDomain(input: string): string {
  const raw = input.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  try {
    const host = new URL(`http://${raw}`).hostname;
    return host.replace(/^www\./, "").replace(/\.+$/, "");
  } catch {
    return "";
  }
}

/** Accepts dot-separated labels of letters/digits/hyphens, e.g. acme.com, blog.acme.co.id */
export function isValidDomain(domain: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
    domain,
  );
}

export function detectCitation(
  sources: Source[],
  text: string,
  brandName: string,
  brandDomain: string,
) {
  const domain = normalizeDomain(brandDomain);
  const cited = sources.some((s) => {
    try {
      const host = new URL(s.url).hostname.toLowerCase().replace(/^www\./, "");
      return host === domain || host.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  });
  const mentioned =
    text.toLowerCase().includes(brandName.toLowerCase()) ||
    text.toLowerCase().includes(domain);
  return { cited, mentioned };
}

// Source URLs originate from LLM output and scraped pages — untrusted.
// Only http(s) URLs are kept so a javascript: URI can never reach an href.
export function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    try {
      const protocol = new URL(s.url).protocol;
      if (protocol !== "http:" && protocol !== "https:") return false;
    } catch {
      return false;
    }
    seen.add(s.url);
    return true;
  });
}
