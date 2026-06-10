import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { completeOnboarding } from "@/app/actions";
import { INDUSTRIES, COMPANY_SIZES, FREE_CREDITS } from "@/lib/constants";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  if (user.company && user.industry && user.companySize) redirect("/dashboard");

  return (
    <main className="flex-1 flex items-center justify-center px-7 py-16">
      <div className="w-full max-w-[520px]">
        <span className="mono block text-muted mb-3.5">One last step</span>
        <h1 className="text-[2rem] mb-3">Tell us about your company</h1>
        <p className="text-muted mb-9 text-pretty">
          This unlocks your workspace and {FREE_CREDITS} free citation checks.
        </p>

        <form action={completeOnboarding} className="flex flex-col gap-5.5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="company" className="mono text-muted">
              Company name
            </label>
            <input
              id="company"
              name="company"
              required
              maxLength={200}
              placeholder="Acme Inc."
              className="field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="industry" className="mono text-muted">
                Industry
              </label>
              <select id="industry" name="industry" required className="field" defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="companySize" className="mono text-muted">
                Company size
              </label>
              <select id="companySize" name="companySize" required className="field" defaultValue="">
                <option value="" disabled>
                  Select…
                </option>
                {COMPANY_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s} people
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary self-start mt-1.5">
            Enter workspace
          </button>
        </form>
      </div>
    </main>
  );
}
