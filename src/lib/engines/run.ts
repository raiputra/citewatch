import { and, eq, sql } from "drizzle-orm";
import { db, prompt as promptTable, run as runTable, user as userTable, apiKey as apiKeyTable } from "@/db";
import { decrypt } from "@/lib/crypto";
import { engineProvider, PROVIDERS } from "@/lib/constants";
import { runLlmEngine } from "./llm";
import { runAiOverview } from "./ai-overview";
import type { EngineInput, EngineResult } from "./types";

type PromptRow = typeof promptTable.$inferSelect;

export type PlannedEngine = {
  runId: string;
  engine: string;
  ownDirectKey?: string;
  ownOpenrouterKey?: string;
  usesCredit: boolean;
};

/**
 * Marks runs stuck in `pending` for over 10 minutes as errored and refunds
 * their reserved credits. A batch interrupted by a function crash or the
 * platform time cap would otherwise show "Running…" forever and eat the
 * reservation.
 */
export async function sweepStaleRuns(userId: string) {
  const swept = await db
    .update(runTable)
    .set({
      status: "error",
      error: "Timed out: the run was interrupted before finishing. Your credit was refunded.",
    })
    .where(
      and(
        eq(runTable.userId, userId),
        eq(runTable.status, "pending"),
        sql`${runTable.createdAt} < now() - interval '10 minutes'`,
      ),
    )
    .returning({ usedOwnKey: runTable.usedOwnKey });

  const refund = swept.filter((r) => !r.usedOwnKey).length;
  if (refund > 0) {
    await db
      .update(userTable)
      .set({ credits: sql`${userTable.credits} + ${refund}` })
      .where(eq(userTable.id, userId));
  }
}

async function userKeys(userId: string): Promise<Map<string, string>> {
  const rows = await db.select().from(apiKeyTable).where(eq(apiKeyTable.userId, userId));
  return new Map(rows.map((r) => [r.provider, decrypt(r.encryptedKey)]));
}

async function executeEngine(engine: string, input: EngineInput): Promise<EngineResult> {
  if (engine === "ai-overview") return runAiOverview(input);
  return runLlmEngine(engine, input);
}

/**
 * Phase 1 — plan the batch and persist it. Every runnable engine gets a
 * `pending` row immediately, so the UI reflects an in-flight batch across
 * refreshes; skipped/unavailable engines get their error rows up front.
 *
 * Credits are RESERVED here with atomic guarded decrements, before any
 * engine executes — concurrent batches race on the database row, not on a
 * stale balance read, so a user can never trigger more platform-funded
 * calls than they have credits. Failed runs are refunded in phase 2.
 */
export async function startPromptRun(p: PromptRow): Promise<{
  planned: PlannedEngine[];
  skipped: number;
}> {
  const keys = await userKeys(p.userId);

  const candidates = p.engines.map((engine) => {
    const provider = engineProvider(engine);
    const ownDirectKey = keys.get(provider);
    const ownOpenrouterKey = keys.get("openrouter");
    const envVar = PROVIDERS.find((pr) => pr.id === provider)?.envVar;
    const hasPlatformKey =
      !!(envVar && process.env[envVar]) || !!process.env.OPENROUTER_API_KEY;
    const hasOwnKey = !!ownDirectKey || !!ownOpenrouterKey;
    const runnable = hasOwnKey || hasPlatformKey;
    return { engine, ownDirectKey, ownOpenrouterKey, usesCredit: !hasOwnKey, runnable };
  });

  const unavailable = candidates.filter((e) => !e.runnable);

  // Reserve one credit per non-BYOK engine, atomically. Engines that can't
  // get a reservation are skipped — never executed on the platform's dime.
  const toRun: typeof candidates = [];
  const skipped: typeof candidates = [];
  for (const e of candidates.filter((c) => c.runnable)) {
    if (!e.usesCredit) {
      toRun.push(e);
      continue;
    }
    const reserved = await db
      .update(userTable)
      .set({ credits: sql`${userTable.credits} - 1` })
      .where(and(eq(userTable.id, p.userId), sql`${userTable.credits} > 0`))
      .returning({ credits: userTable.credits });
    if (reserved.length > 0) toRun.push(e);
    else skipped.push(e);
  }

  const batchId = crypto.randomUUID();

  await Promise.all([
    ...skipped.map(({ engine }) =>
      db.insert(runTable).values({
        promptId: p.id,
        userId: p.userId,
        batchId,
        engine,
        status: "error",
        error: "Skipped: out of credits. Add your own API key in Settings to keep running this engine.",
      }),
    ),
    ...unavailable.map(({ engine }) =>
      db.insert(runTable).values({
        promptId: p.id,
        userId: p.userId,
        batchId,
        engine,
        status: "error",
        error: "Skipped: no API key available for this engine. Add your own key in Settings.",
      }),
    ),
  ]);

  const planned = await Promise.all(
    toRun.map(async (e) => {
      const [row] = await db
        .insert(runTable)
        .values({
          promptId: p.id,
          userId: p.userId,
          batchId,
          engine: e.engine,
          status: "pending",
          usedOwnKey: !e.usesCredit,
        })
        .returning({ id: runTable.id });
      return { ...e, runId: row.id };
    }),
  );

  return { planned, skipped: skipped.length + unavailable.length };
}

/**
 * Phase 2 — execute the batch and update the pending rows in place. Runs
 * after the HTTP response is sent (via `after()`), so a client refresh or
 * disconnect can't interrupt it. Credits were reserved in phase 1; failed
 * engines refund their reservation. Row updates are guarded on
 * status='pending' so a stale-sweep that already errored (and refunded) a
 * row can't be double-refunded here.
 */
export async function executePromptRun(p: PromptRow, planned: PlannedEngine[]) {
  await Promise.allSettled(
    planned.map(async ({ runId, engine, ownDirectKey, ownOpenrouterKey, usesCredit }) => {
      try {
        const input: EngineInput = {
          query: p.query,
          language: p.language,
          country: p.country,
          brandName: p.brandName,
          brandDomain: p.brandDomain,
          directKey: ownDirectKey,
          openrouterKey: ownOpenrouterKey,
        };
        const result = await executeEngine(engine, input);

        await db
          .update(runTable)
          .set({
            status: "done",
            model: result.model,
            responseText: result.text,
            sources: result.sources,
            cited: result.cited,
            mentioned: result.mentioned,
            latencyMs: result.latencyMs,
          })
          .where(and(eq(runTable.id, runId), eq(runTable.status, "pending")));
      } catch (err) {
        const updated = await db
          .update(runTable)
          .set({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          })
          .where(and(eq(runTable.id, runId), eq(runTable.status, "pending")))
          .returning({ id: runTable.id });

        // Refund the reservation — only if this call actually transitioned
        // the row (the stale sweep refunds rows it claims)
        if (usesCredit && updated.length > 0) {
          await db
            .update(userTable)
            .set({ credits: sql`${userTable.credits} + 1` })
            .where(eq(userTable.id, p.userId));
        }
      }
    }),
  );
}
