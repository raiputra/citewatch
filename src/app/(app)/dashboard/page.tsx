import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db, prompt as promptTable, run as runTable } from "@/db";
import { requireOnboardedUser } from "@/lib/session";
import { engineLabel, LANGUAGES, COUNTRIES } from "@/lib/constants";
import { sweepStaleRuns } from "@/lib/engines/run";

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  await sweepStaleRuns(user.id);

  const prompts = await db
    .select()
    .from(promptTable)
    .where(eq(promptTable.userId, user.id))
    .orderBy(desc(promptTable.createdAt));

  const runs = prompts.length
    ? await db
        .select()
        .from(runTable)
        .where(
          inArray(
            runTable.promptId,
            prompts.map((p) => p.id),
          ),
        )
        .orderBy(desc(runTable.createdAt))
    : [];

  const byPrompt = new Map<string, typeof runs>();
  for (const r of runs) {
    const list = byPrompt.get(r.promptId) ?? [];
    list.push(r);
    byPrompt.set(r.promptId, list);
  }

  const doneRuns = runs.filter((r) => r.status === "done");
  const citedRuns = doneRuns.filter((r) => r.cited);
  const mentionedRuns = doneRuns.filter((r) => r.mentioned);
  const citationRate = doneRuns.length
    ? Math.round((citedRuns.length / doneRuns.length) * 100)
    : null;
  const mentionRate = doneRuns.length
    ? Math.round((mentionedRuns.length / doneRuns.length) * 100)
    : null;

  return (
    <div>
      <div className="flex items-end justify-between gap-10 mb-12 flex-wrap">
        <div>
          <span className="mono block text-muted mb-3">{user.company}</span>
          <h1 className="text-[2.4rem]">Citation dashboard</h1>
        </div>
        <Link href="/prompts/new" className="btn btn-primary">
          Track a new prompt
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-line border border-line rounded-[2px] overflow-hidden mb-14">
        {[
          { label: "Tracked prompts", value: prompts.length },
          { label: "Total checks", value: doneRuns.length },
          { label: "Cited answers", value: citedRuns.length },
          {
            label: "Citation rate",
            value: citationRate === null ? "—" : `${citationRate}%`,
          },
          { label: "Mentions", value: mentionedRuns.length },
          {
            label: "Mention rate",
            value: mentionRate === null ? "—" : `${mentionRate}%`,
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-bg px-8 py-7">
            <span className="mono block text-muted mb-2">{stat.label}</span>
            <span className="font-serif text-[2rem] leading-none text-primary">
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      {prompts.length === 0 ? (
        <div className="border border-line rounded-[2px] bg-bg-alt px-10 py-16 text-center">
          <h2 className="text-2xl mb-3">No prompts tracked yet</h2>
          <p className="text-muted mb-8 max-w-[440px] mx-auto text-pretty">
            Add a prompt your customers might ask an AI assistant, and we&apos;ll
            check whether the answers cite your brand.
          </p>
          <Link href="/prompts/new" className="btn btn-primary">
            Track your first prompt
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {prompts.map((p) => {
            const pruns = byPrompt.get(p.id) ?? [];
            const pdone = pruns.filter((r) => r.status === "done");
            const pcited = pdone.filter((r) => r.cited);
            const pmentioned = pdone.filter((r) => r.mentioned);
            const lang = LANGUAGES.find((l) => l.code === p.language)?.label ?? p.language;
            const country = COUNTRIES.find((c) => c.code === p.country)?.label ?? p.country;
            return (
              <Link
                key={p.id}
                href={`/prompts/${p.id}`}
                className="card block p-8"
              >
                <div className="flex items-baseline gap-2.5 mb-4 flex-wrap">
                  <span className="font-medium text-[0.95rem]">{p.brandName}</span>
                  <span className="mono text-primary">{p.brandDomain}</span>
                </div>
                <h3 className="text-[1.15rem] mb-3 leading-snug">{p.query}</h3>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className="tag">{lang}</span>
                  <span className="tag">{country}</span>
                  {p.engines.map((e) => (
                    <span key={e} className="tag">
                      {engineLabel(e)}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted">
                  {pdone.length === 0
                    ? "Not checked yet"
                    : `${pcited.length} cited · ${pmentioned.length} mentioned · ${pdone.length} checks`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
