"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  user as userTable,
  prompt as promptTable,
  apiKey as apiKeyTable,
  creditRequest as creditRequestTable,
} from "@/db";
import { requireUser, requireOnboardedUser } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import {
  ENGINES,
  INDUSTRIES,
  COMPANY_SIZES,
  LANGUAGES,
  COUNTRIES,
  PROVIDERS,
  CREDIT_VOLUMES,
} from "@/lib/constants";
import { normalizeDomain, isValidDomain } from "@/lib/engines/types";
import { notifyN8n } from "@/lib/n8n";

/* ─── Onboarding ─────────────────────────────────── */

const onboardingSchema = z.object({
  company: z.string().trim().min(1).max(200),
  industry: z.enum(INDUSTRIES as [string, ...string[]]),
  companySize: z.enum(COMPANY_SIZES as [string, ...string[]]),
});

export async function completeOnboarding(formData: FormData) {
  const u = await requireUser();
  const parsed = onboardingSchema.safeParse({
    company: formData.get("company"),
    industry: formData.get("industry"),
    companySize: formData.get("companySize"),
  });
  if (!parsed.success) throw new Error("Please fill in all fields.");

  await db.update(userTable).set(parsed.data).where(eq(userTable.id, u.id));
  redirect("/dashboard");
}

/* ─── Prompts ────────────────────────────────────── */

const engineIds = ENGINES.map((e) => e.id);

const promptSchema = z.object({
  query: z.string().trim().min(3).max(500),
  language: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]),
  country: z.enum(COUNTRIES.map((c) => c.code) as [string, ...string[]]),
  brandName: z.string().trim().min(1).max(120),
  // Canonicalized (protocol/www/path/port stripped), then shape-validated
  brandDomain: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .transform(normalizeDomain)
    .refine(isValidDomain, {
      message: "Enter a valid domain, e.g. acme.com or blog.acme.co.id",
    }),
  engines: z.array(z.enum(engineIds as [string, ...string[]])).min(1),
});

export async function createPrompt(formData: FormData) {
  const u = await requireOnboardedUser();
  const parsed = promptSchema.safeParse({
    query: formData.get("query"),
    language: formData.get("language"),
    country: formData.get("country"),
    brandName: formData.get("brandName"),
    brandDomain: formData.get("brandDomain"),
    engines: formData.getAll("engines"),
  });
  if (!parsed.success) throw new Error("Invalid prompt data.");

  const [created] = await db
    .insert(promptTable)
    .values({ userId: u.id, ...parsed.data })
    .returning({ id: promptTable.id });

  redirect(`/prompts/${created.id}`);
}

export async function updatePrompt(formData: FormData) {
  const u = await requireOnboardedUser();
  const promptId = formData.get("promptId") as string;
  if (!promptId) throw new Error("Missing prompt id.");

  const parsed = promptSchema.safeParse({
    query: formData.get("query"),
    language: formData.get("language"),
    country: formData.get("country"),
    brandName: formData.get("brandName"),
    brandDomain: formData.get("brandDomain"),
    engines: formData.getAll("engines"),
  });
  if (!parsed.success) throw new Error("Invalid prompt data.");

  await db
    .update(promptTable)
    .set(parsed.data)
    .where(and(eq(promptTable.id, promptId), eq(promptTable.userId, u.id)));

  revalidatePath(`/prompts/${promptId}`);
  redirect(`/prompts/${promptId}`);
}

export async function deletePrompt(promptId: string) {
  const u = await requireUser();
  await db
    .delete(promptTable)
    .where(and(eq(promptTable.id, promptId), eq(promptTable.userId, u.id)));
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/* ─── Credit requests ────────────────────────────── */

const creditRequestSchema = z.object({
  monthlyCredits: z.enum(CREDIT_VOLUMES as [string, ...string[]]),
  topEngines: z.array(z.enum(engineIds as [string, ...string[]])),
  suggestions: z.string().trim().max(2000).optional(),
  servicesInterest: z.boolean(),
});

export async function submitCreditRequest(formData: FormData) {
  const u = await requireOnboardedUser();
  const parsed = creditRequestSchema.safeParse({
    monthlyCredits: formData.get("monthlyCredits"),
    topEngines: formData.getAll("topEngines"),
    suggestions: (formData.get("suggestions") as string) || undefined,
    servicesInterest: formData.get("servicesInterest") === "on",
  });
  if (!parsed.success) throw new Error("Please pick how many credits you need.");

  const [created] = await db
    .insert(creditRequestTable)
    .values({
      userId: u.id,
      monthlyCredits: parsed.data.monthlyCredits,
      topEngines: parsed.data.topEngines,
      suggestions: parsed.data.suggestions ?? null,
      servicesInterest: parsed.data.servicesInterest,
    })
    .returning({ id: creditRequestTable.id, createdAt: creditRequestTable.createdAt });

  // Notify after the response — webhook latency or downtime never blocks
  // the form, and the DB row is already safe.
  after(() =>
    notifyN8n({
      event: "credit_request.created",
      createdAt: created.createdAt.toISOString(),
      request: {
        id: created.id,
        monthlyCredits: parsed.data.monthlyCredits,
        topEngines: parsed.data.topEngines,
        suggestions: parsed.data.suggestions ?? null,
        servicesInterest: parsed.data.servicesInterest,
      },
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        company: u.company,
        industry: u.industry,
        companySize: u.companySize,
        creditsRemaining: u.credits,
      },
    }),
  );
}

/* ─── BYOK keys ──────────────────────────────────── */

const providerIds = PROVIDERS.map((p) => p.id);

export async function saveApiKey(formData: FormData) {
  const u = await requireUser();
  const provider = formData.get("provider") as string;
  const key = (formData.get("key") as string)?.trim();
  if (!providerIds.includes(provider as (typeof providerIds)[number]) || !key || key.length < 8) {
    throw new Error("Invalid key.");
  }

  await db
    .insert(apiKeyTable)
    .values({
      userId: u.id,
      provider,
      encryptedKey: encrypt(key),
      last4: key.slice(-4),
    })
    .onConflictDoUpdate({
      target: [apiKeyTable.userId, apiKeyTable.provider],
      set: { encryptedKey: encrypt(key), last4: key.slice(-4) },
    });

  revalidatePath("/settings");
}

export async function deleteApiKey(provider: string) {
  const u = await requireUser();
  await db
    .delete(apiKeyTable)
    .where(and(eq(apiKeyTable.userId, u.id), eq(apiKeyTable.provider, provider)));
  revalidatePath("/settings");
}
