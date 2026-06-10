"use client";

// Renders a timestamp in the visitor's own timezone and locale. The server
// renders UTC during SSR; suppressHydrationWarning lets the client swap in
// the local rendering without a mismatch error.
export function LocalTime({ date }: { date: Date | string }) {
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} suppressHydrationWarning>
      {new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d)}
    </time>
  );
}
