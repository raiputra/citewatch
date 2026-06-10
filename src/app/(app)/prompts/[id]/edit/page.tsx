import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, prompt as promptTable } from "@/db";
import { requireOnboardedUser } from "@/lib/session";
import { updatePrompt } from "@/app/actions";
import { PromptForm } from "@/components/prompt-form";

export default async function EditPromptPage({
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

  return (
    <div className="max-w-[640px]">
      <Link
        href={`/prompts/${p.id}`}
        className="text-sm text-primary hover:opacity-75 transition-opacity"
      >
        ← Back to prompt
      </Link>
      <h1 className="text-[2.2rem] mt-6 mb-3">Edit prompt</h1>
      <p className="text-muted mb-10 text-pretty">
        Changes apply to future checks. Existing run history is kept as-is.
      </p>

      <PromptForm
        action={updatePrompt}
        promptId={p.id}
        submitLabel="Save changes"
        defaults={{
          query: p.query,
          language: p.language,
          country: p.country,
          brandName: p.brandName,
          brandDomain: p.brandDomain,
          engines: p.engines,
        }}
      />
    </div>
  );
}
