"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls the server while a run batch is pending so results stream into the
// page without manual refreshes. The batch itself runs server-side and is
// unaffected by navigation.
export function AutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [enabled, router]);

  return null;
}
