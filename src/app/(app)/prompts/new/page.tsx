import { createPrompt } from "@/app/actions";
import { PromptForm } from "@/components/prompt-form";

export default function NewPromptPage() {
  return (
    <div className="max-w-[640px]">
      <span className="mono block text-muted mb-3">New prompt</span>
      <h1 className="text-[2.2rem] mb-3">Track a prompt</h1>
      <p className="text-muted mb-10 text-pretty">
        Write the question the way a real customer would ask it — in the target
        language. Each engine check costs 1 credit unless you&apos;ve added your
        own key for that provider.
      </p>

      <PromptForm action={createPrompt} submitLabel="Create prompt" />
    </div>
  );
}
