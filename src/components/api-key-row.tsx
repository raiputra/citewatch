"use client";

import { useRef, useTransition } from "react";
import { saveApiKey, deleteApiKey } from "@/app/actions";

export function ApiKeyRow({
  provider,
  label,
  last4,
}: {
  provider: string;
  label: string;
  last4: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex items-center gap-4 py-4 border-b border-line last:border-b-0 flex-wrap">
      <span className="font-medium w-52 shrink-0">{label}</span>

      {last4 ? (
        <>
          <span className="mono text-muted">••••{last4}</span>
          <button
            className="ml-auto text-sm text-muted hover:text-accent transition-colors cursor-pointer"
            disabled={pending}
            onClick={() => startTransition(() => deleteApiKey(provider))}
          >
            Remove
          </button>
        </>
      ) : (
        <form
          ref={formRef}
          className="flex items-center gap-2.5 flex-1 min-w-60"
          action={(fd) =>
            startTransition(async () => {
              await saveApiKey(fd);
              formRef.current?.reset();
            })
          }
        >
          <input type="hidden" name="provider" value={provider} />
          <input
            type="password"
            name="key"
            required
            minLength={8}
            placeholder="Paste API key"
            className="field flex-1"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-ghost py-2.5! px-4!" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
