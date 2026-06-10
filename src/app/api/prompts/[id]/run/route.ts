import { NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, prompt as promptTable } from "@/db";
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
