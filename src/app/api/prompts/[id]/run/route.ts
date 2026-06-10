import { NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, prompt as promptTable, run as runTable } from "@/db";
import { getSessionUser } from "@/lib/session";
import { startPromptRun, executePromptRun } from "@/lib/engines/run";

// Engine fan-out + headless browser keep running via after(); maxDuration
// caps the whole invocation including that post-response work.
export const maxDuration = 300;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const u = await getSessionUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [p] = await db
    .select()
    .from(promptTable)
    .where(and(eq(promptTable.id, id), eq(promptTable.userId, u.id)));
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // One in-flight batch per prompt — blocks run-spamming and accidental
  // double-clicks alike
  const [inFlight] = await db
    .select({ id: runTable.id })
    .from(runTable)
    .where(and(eq(runTable.promptId, p.id), eq(runTable.status, "pending")))
    .limit(1);
  if (inFlight) {
    return NextResponse.json(
      { error: "A check is already running for this prompt. Wait for it to finish." },
      { status: 409 },
    );
  }

  try {
    const { planned, skipped } = await startPromptRun(p);

    // Engines execute after the response is sent — a page refresh or closed
    // tab no longer interrupts the batch. Results land in the run rows.
    after(() =>
      executePromptRun(p, planned).catch((err) =>
        console.error("executePromptRun failed:", err),
      ),
    );

    return NextResponse.json({ started: planned.length, skipped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Run failed" },
      { status: 500 },
    );
  }
}
