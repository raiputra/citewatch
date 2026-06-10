"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunButton({ promptId }: { promptId: string }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/prompts/${promptId}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button className="btn btn-primary" onClick={run} disabled={running}>
        {running ? "Starting…" : "Run check now"}
      </button>
      {error && <span className="text-sm text-accent">{error}</span>}
    </div>
  );
}
