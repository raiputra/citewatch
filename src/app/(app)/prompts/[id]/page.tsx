import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db, prompt as promptTable, run as runTable } from "@/db";
import { requireOnboardedUser } from "@/lib/session";
import { ENGINES, engineLabel, LANGUAGES, COUNTRIES } from "@/lib/constants";
import { RunButton } from "@/components/run-button";
import { DeletePrompt } from "@/components/delete-prompt";
import { AutoRefresh } from "@/components/auto-refresh";
import { LocalTime } from "@/components/local-time";
import { sweepStaleRuns } from "@/lib/engines/run";

type RunRow = typeof runTable.$inferSelect;

const engineOrder = new Map(ENGINES.map((e, i) => [e.id as string, i]));

/**
 * Groups runs into batches. Rows with a batchId group exactly by request.
 * Legacy rows (created before batching, stamped at engine COMPLETION time)
 * are clustered by gap: consecutive rows within 5 minutes of each other
 * belong to the same fan-out.
 */
function groupRuns(runs: RunRow[]): RunRow[][] {
  const batches = new Map<string, RunRow[]>();
  const legacy: RunRow[] = [];
  for (const r of runs) {
    if (!r.batchId) {
      legacy.push(r);
      continue;
    }
    const list = batches.get(r.batchId) ?? [];
    list.push(r);
    batches.set(r.batchId, list);
  }

  // runs arrive sorted newest-first; chain rows while the gap stays small
  const legacyGroups: RunRow[][] = [];
  for (const r of legacy) {
    const current = legacyGroups[legacyGroups.length - 1];
    const last = current?.[current.length - 1];
    if (last && last.createdAt.getTime() - r.createdAt.getTime() <= 5 * 60 * 1000) {
      current.push(r);
    } else {
      legacyGroups.push([r]);
    }
  }

  const startOf = (batch: RunRow[]) =>
    Math.min(...batch.map((r) => r.createdAt.getTime()));

  return [...batches.values(), ...legacyGroups]
    .sort((a, b) => startOf(b) - startOf(a))
    .map((batch) =>
      [...batch].sort(
        (a, b) => (engineOrder.get(a.engine) ?? 99) - (engineOrder.get(b.engine) ?? 99),
      ),
    );
}

export default async function PromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireOnboardedUser();
  const { id } = await params;

  const [p] = await db
    .select()
    .from(promptTable)
    .where(and(eq(promptTable.id, id), eq(promptTable.userId, user.id)));
  if (!p) notFound();

  await sweepStaleRuns(user.id);

  const runs = await db
    .select()
    .from(runTable)
    .where(eq(runTable.promptId, p.id))
    .orderBy(desc(runTable.createdAt));

  const lang = LANGUAGES.find((l) => l.code === p.language)?.label ?? p.language;
  const country = COUNTRIES.find((c) => c.code === p.country)?.label ?? p.country;
  const hasPending = runs.some((r) => r.status === "pending");

  const grouped = groupRuns(runs);

  return (
    <div>
      <AutoRefresh enabled={hasPending} />
      <Link
        href="/dashboard"
        className="text-sm text-primary hover:opacity-75 transition-opacity"
      >
        ← Dashboard
      </Link>

      <div className="flex items-start justify-between gap-10 mt-6 mb-4 flex-wrap">
        <h1 className="text-[1.9rem] max-w-[720px] leading-tight">{p.query}</h1>
        <div className="flex items-center gap-4">
          <Link href={`/prompts/${p.id}/edit`} className="btn btn-ghost">
            Edit
          </Link>
          <RunButton promptId={p.id} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-12">
        <span className="tag">{lang}</span>
        <span className="tag">{country}</span>
        <span className="tag">{p.brandName}</span>
        <span className="tag">{p.brandDomain}</span>
        {p.engines.map((e) => (
          <span key={e} className="tag">
            {engineLabel(e)}
          </span>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="border border-line rounded-[2px] bg-bg-alt px-10 py-14 text-center">
          <p className="text-muted">
            No checks yet. Hit <strong className="text-ink">Run check now</strong> to
            query every selected engine.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {grouped.map((batch) => {
            const done = batch.filter((r) => r.status === "done");
            const cited = done.filter((r) => r.cited).length;
            const mentioned = done.filter((r) => r.mentioned).length;
            const pending = batch.filter((r) => r.status === "pending").length;
            // Earliest row = request time for batched runs (rows are inserted
            // as pending before engines execute)
            const startedAt = new Date(
              Math.min(...batch.map((r) => r.createdAt.getTime())),
            );
            return (
              <section
                key={batch[0].batchId ?? batch[0].id}
                className="border border-line rounded-[2px] overflow-hidden"
              >
                <div className="flex items-center gap-4 px-7 py-4 bg-bg-alt border-b border-line flex-wrap">
                  <span className="mono text-muted">
                    Check · <LocalTime date={startedAt} />
                  </span>
                  <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                    {pending > 0 && (
                      <span className="tag tag-pending">{pending} running</span>
                    )}
                    {done.length > 0 && (
                      <>
                        <span className={`tag ${cited > 0 ? "tag-green" : ""}`}>
                          {cited}/{done.length} cited
                        </span>
                        <span className={`tag ${mentioned > 0 ? "tag-green" : ""}`}>
                          {mentioned}/{done.length} mentioned
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {batch.map((r) => (
                  <details
                    key={r.id}
                    className="border-t border-line first-of-type:border-t-0 bg-bg open:bg-bg-alt transition-colors"
                  >
                    <summary className="flex items-center gap-5 px-7 py-4 cursor-pointer list-none flex-wrap">
                      <span className="font-medium w-44">{engineLabel(r.engine)}</span>
                      {r.status === "pending" ? (
                        <span className="tag tag-pending">Running…</span>
                      ) : r.status === "error" ? (
                        <span className="tag tag-red">Error</span>
                      ) : (
                        <>
                          <span className={`tag ${r.cited ? "tag-green" : ""}`}>
                            {r.cited ? "✓ Cited" : "Not cited"}
                          </span>
                          <span className={`tag ${r.mentioned ? "tag-green" : ""}`}>
                            {r.mentioned ? "✓ Mentioned" : "No mention"}
                          </span>
                        </>
                      )}
                      <span className="mono text-muted ml-auto">
                        {r.usedOwnKey ? "own key · " : ""}
                        {r.latencyMs ? `${(r.latencyMs / 1000).toFixed(1)}s` : ""}
                      </span>
                    </summary>
                    <div className="px-7 pb-7 pt-2">
                      {r.status === "pending" ? (
                        <p className="text-sm text-muted">Check in progress…</p>
                      ) : r.status === "error" ? (
                        <p className="text-sm text-accent">{r.error}</p>
                      ) : (
                        <>
                          {r.responseText ? (
                            <p className="text-[0.95rem] text-muted whitespace-pre-wrap leading-relaxed mb-6">
                              {r.responseText}
                            </p>
                          ) : (
                            <p className="text-sm text-muted mb-6">
                              No AI Overview was shown for this query/locale.
                            </p>
                          )}
                          {!!r.sources?.length && (
                            <>
                              <span className="mono block text-muted mb-3">
                                Sources ({r.sources.length})
                              </span>
                              <ul className="flex flex-col gap-2">
                                {r.sources.map((s, i) => (
                                  <li key={i} className="text-sm truncate">
                                    <a
                                      href={/^https?:\/\//i.test(s.url) ? s.url : "#"}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary underline decoration-primary/35 underline-offset-3 hover:decoration-primary"
                                    >
                                      {s.title || s.url}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </details>
                ))}
              </section>
            );
          })}
        </div>
      )}

      <div className="mt-14 pt-7 border-t border-line">
        <DeletePrompt promptId={p.id} />
      </div>
    </div>
  );
}
