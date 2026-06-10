// Server-only n8n notification. Credentials live in env, never in client
// code; absence of N8N_WEBHOOK_URL silently disables the integration so
// open-source deployments work without it.

type CreditRequestPayload = {
  event: "credit_request.created";
  createdAt: string;
  request: {
    id: string;
    monthlyCredits: string;
    topEngines: string[];
    suggestions: string | null;
    servicesInterest: boolean;
  };
  user: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    industry: string | null;
    companySize: string | null;
    creditsRemaining: number;
  };
};

export async function notifyN8n(payload: CreditRequestPayload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = process.env.N8N_WEBHOOK_USER;
  const pass = process.env.N8N_WEBHOOK_PASS;
  if (user && pass) {
    headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.error(`n8n webhook responded ${res.status}`);
  } catch (err) {
    console.error("n8n webhook failed:", err);
  }
}
