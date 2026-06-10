// Diagnostic for the AI Overview scrape path. Mirrors scrapeSerp() in
// src/lib/engines/ai-overview.ts and dumps what Google actually serves.
// Usage: node scripts/test-ai-overview.mjs "query" [lang] [country]
import { chromium } from "playwright-core";

const query = process.argv[2] ?? "best accounting software for small business";
const hl = process.argv[3] ?? "en";
const gl = (process.argv[4] ?? "us").toLowerCase();

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: [
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
  ],
});
const context = await browser.newContext({
  locale: `${hl}-${gl.toUpperCase()}`,
  viewport: { width: 1366, height: 900 },
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  extraHTTPHeaders: { "Accept-Language": `${hl}-${gl.toUpperCase()},${hl};q=0.9` },
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined });
});
const page = await context.newPage();

const params = new URLSearchParams({ q: query, hl, gl });
await page.goto(`https://www.google.com/search?${params}`, {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});

if (page.url().includes("/sorry/")) {
  console.error("CAPTCHA — Google blocked the request");
  process.exit(1);
}

for (const label of ["Accept all", "Reject all", "I agree"]) {
  const btn = page.getByRole("button", { name: label }).first();
  if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await btn.click().catch(() => {});
    break;
  }
}
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  const results =
    document.querySelector("#rso") ?? document.querySelector("#search") ?? document.body;
  const pageText = (results.innerText ?? "").slice(0, 16000);
  const links = Array.from(results.querySelectorAll("a[href^='http']")).filter(
    (a) => !/(^https?:\/\/[^/]*google\.)/.test(a.href),
  ).length;
  return {
    textChars: pageText.length,
    links,
    aiOverviewHit: /AI Overview|Ringkasan AI|AI による概要|Übersicht mit KI/i.test(
      document.body.innerText,
    ),
    head: pageText.slice(0, 300).replace(/\n+/g, " | "),
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
