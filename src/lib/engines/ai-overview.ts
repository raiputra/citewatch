import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import {
  type EngineInput,
  type EngineResult,
  resolveCredentials,
  detectCitation,
  dedupeSources,
} from "./types";

// Model used to turn the raw SERP scrape into structured output
const EXTRACT_MODEL = process.env.AI_OVERVIEW_MODEL ?? "gpt-5.1";

/**
 * Captures Google's AI Overview for a query, localized via hl (language)
 * and gl (country).
 *
 * Headless Chromium (@sparticuz/chromium on Vercel, local Chrome in dev)
 * loads the SERP, then the raw page text + links are handed to ChatGPT
 * for structured extraction — cheaper than a SERP API subscription and
 * far more resilient than hand-written DOM selectors. Caveat: Google may
 * serve a consent wall or captcha to datacenter IPs.
 */
export async function runAiOverview(input: EngineInput): Promise<EngineResult> {
  const start = Date.now();

  const scraped = await scrapeSerp(input);
  const extracted = await extractWithGpt(input, scraped);

  const sources = dedupeSources(extracted.sources);
  const { cited, mentioned } = detectCitation(
    sources,
    extracted.text,
    input.brandName,
    input.brandDomain,
  );

  return {
    engine: "ai-overview",
    model: `headless+${EXTRACT_MODEL}`,
    text: extracted.text,
    sources,
    cited,
    mentioned,
    latencyMs: Date.now() - start,
  };
}

/* ─── Headless scrape ────────────────────────────── */

type ScrapedSerp = {
  pageText: string;
  links: { url: string; title?: string }[];
};

// Without these, Google detects automation and serves a /sorry captcha
// instead of the SERP.
const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--no-first-run",
  "--no-default-browser-check",
];

async function scrapeSerp(input: EngineInput): Promise<ScrapedSerp> {
  const { chromium } = await import("playwright-core");
  const isVercel = !!process.env.VERCEL;

  const browser = isVercel
    ? await (async () => {
        const sparticuz = (await import("@sparticuz/chromium")).default;
        return chromium.launch({
          args: [...sparticuz.args, ...STEALTH_ARGS],
          executablePath: await sparticuz.executablePath(),
          headless: true,
        });
      })()
    : await chromium.launch({ headless: true, channel: "chrome", args: STEALTH_ARGS });

  try {
    const context = await browser.newContext({
      locale: `${input.language}-${input.country}`,
      viewport: { width: 1366, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": `${input.language}-${input.country},${input.language};q=0.9`,
      },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();

    const params = new URLSearchParams({
      q: input.query,
      hl: input.language,
      gl: input.country.toLowerCase(),
    });
    await page.goto(`https://www.google.com/search?${params}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Surface captchas as errors — silently treating them as "no overview"
    // hides the real problem from the user.
    if (page.url().includes("/sorry/")) {
      throw new Error(
        "Google served a captcha to the automated browser. Try again in a few minutes.",
      );
    }

    // Dismiss the consent wall if Google shows one
    for (const label of ["Accept all", "Reject all", "I agree"]) {
      const btn = page.getByRole("button", { name: label }).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        break;
      }
    }
    // AI Overview streams in after initial load
    await page.waitForTimeout(3000);

    // Expand the overview if Google collapsed it behind "Show more"
    const showMore = page.getByRole("button", { name: /show more|selengkapnya/i }).first();
    if (await showMore.isVisible({ timeout: 500 }).catch(() => false)) {
      await showMore.click().catch(() => {});
      await page.waitForTimeout(800);
    }

    return await page.evaluate(() => {
      const results = (document.querySelector("#rso") ??
        document.querySelector("#search") ??
        document.body) as HTMLElement;
      const pageText = (results.innerText ?? "").slice(0, 16000);
      const links = Array.from(results.querySelectorAll("a[href^='http']"))
        .map((a) => ({
          url: (a as HTMLAnchorElement).href,
          title: (a as HTMLAnchorElement).textContent?.trim() || undefined,
        }))
        .filter((l) => !/(^https?:\/\/[^/]*google\.)/.test(l.url))
        .slice(0, 80);
      return { pageText, links };
    });
  } finally {
    await browser.close();
  }
}

/* ─── Structured extraction via ChatGPT ──────────── */

const extractionSchema = z.object({
  hasAiOverview: z
    .boolean()
    .describe("Whether the page contains an AI Overview block"),
  text: z
    .string()
    .describe("The AI Overview text, verbatim. Empty string if absent."),
  // OpenAI structured outputs require every property to be required,
  // so "no title" is modeled as null rather than an optional field.
  sources: z
    .array(z.object({ url: z.string(), title: z.string().nullable() }))
    .describe("Links cited inside the AI Overview block only"),
});

async function extractWithGpt(
  input: EngineInput,
  scraped: ScrapedSerp,
): Promise<{ text: string; sources: { url: string; title?: string }[] }> {
  if (!scraped.pageText.trim()) return { text: "", sources: [] };

  const creds = resolveCredentials(input, "OPENAI_API_KEY");
  const model =
    creds.mode === "direct"
      ? createOpenAI({ apiKey: creds.key })(EXTRACT_MODEL)
      : createOpenRouter({ apiKey: creds.key }).chat(
          process.env.OPENROUTER_AI_OVERVIEW_MODEL ?? "openai/gpt-5.1",
        );

  const { object } = await generateObject({
    model,
    schema: extractionSchema,
    prompt: [
      `Below is the text content of a Google search results page (interface language "${input.language}", region "${input.country}"), followed by the hyperlinks found on it.`,
      `Determine whether the page contains an AI Overview (a generated summary block, usually at the top — its heading is localized, e.g. "AI Overview", "Ringkasan AI", "Aperçu IA").`,
      `If present, return its text verbatim and list only the links that belong to the AI Overview block (its cited sources), not regular organic results.`,
      `If absent, return hasAiOverview=false, an empty text, and no sources.`,
      ``,
      `── PAGE TEXT ──`,
      scraped.pageText,
      ``,
      `── LINKS ──`,
      scraped.links.map((l) => `${l.url}${l.title ? ` — ${l.title}` : ""}`).join("\n"),
    ].join("\n"),
  });

  if (!object.hasAiOverview) return { text: "", sources: [] };
  return {
    text: object.text,
    sources: object.sources.map((s) => ({ url: s.url, title: s.title ?? undefined })),
  };
}
