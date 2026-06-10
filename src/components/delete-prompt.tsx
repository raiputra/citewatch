"use client";

import { useTransition } from "react";
import { deletePrompt } from "@/app/actions";

export function DeletePrompt({ promptId }: { promptId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="text-sm text-muted hover:text-accent transition-colors cursor-pointer"
      disabled={pending}
      onClick={() => {
        if (confirm("Delete this prompt and all its run history?")) {
          startTransition(() => deletePrompt(promptId));
        }
      }}
    >
      {pending ? "Deleting…" : "Delete prompt"}
    </button>
  );
}
