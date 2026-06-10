import { eq } from "drizzle-orm";
import { db, apiKey as apiKeyTable } from "@/db";
import { requireOnboardedUser } from "@/lib/session";
import { PROVIDERS } from "@/lib/constants";
import { ApiKeyRow } from "@/components/api-key-row";

export default async function SettingsPage() {
  const user = await requireOnboardedUser();
  const keys = await db
    .select()
    .from(apiKeyTable)
    .where(eq(apiKeyTable.userId, user.id));
  const byProvider = new Map(keys.map((k) => [k.provider, k]));

  return (
    <div className="max-w-[720px]">
      <span className="mono block text-muted mb-3">Settings</span>
      <h1 className="text-[2.2rem] mb-12">Workspace</h1>

      <section className="mb-14">
        <h2 className="text-xl mb-2">Profile</h2>
        <p className="text-sm text-muted mb-6">Signed in with Google.</p>
        <div className="border border-line rounded-[2px] bg-bg-alt px-7 py-2">
          {[
            ["Name", user.name],
            ["Email", user.email],
            ["Company", user.company],
            ["Industry", user.industry],
            ["Size", user.companySize ? `${user.companySize} people` : null],
            ["Credits", String(user.credits)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline gap-6 py-3 border-b border-line last:border-b-0"
            >
              <span className="mono text-muted w-24 shrink-0">{label}</span>
              <span className="text-sm">{value ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl mb-2">Your API keys</h2>
        <p className="text-sm text-muted mb-6 text-pretty">
          Bring your own keys and checks for that provider stop consuming
          credits. Keys are encrypted at rest (AES-256-GCM) and only decrypted
          when a check runs.
        </p>
        <div className="border border-line rounded-[2px] bg-bg-alt px-7 py-2">
          {PROVIDERS.map((p) => (
            <ApiKeyRow
              key={p.id}
              provider={p.id}
              label={p.label}
              last4={byProvider.get(p.id)?.last4 ?? null}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
