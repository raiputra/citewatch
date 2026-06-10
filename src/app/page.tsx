import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { signupCap, userCount } from "@/lib/auth";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Footer } from "@/components/footer";
import { ENGINES, FREE_CREDITS } from "@/lib/constants";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;
  const cap = signupCap();
  const taken = cap > 0 ? await userCount() : 0;
  const seatsLeft = cap > 0 ? Math.max(0, cap - taken) : null;
  const full = seatsLeft === 0;

  return (
    <main className="flex-1 flex flex-col">
      <nav className="border-b border-line">
        <div className="max-w-[1200px] mx-auto px-12 py-5 flex items-center justify-between">
          <span className="font-serif text-xl tracking-tight">Citewatch</span>
          <a
            className="text-sm font-medium opacity-75 hover:opacity-100 transition-opacity"
            href="https://github.com/raiputra/citewatch"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
      </nav>

      <section className="flex-1 flex items-center">
        <div className="max-w-[1200px] mx-auto px-12 py-24 grid md:grid-cols-2 gap-20 items-center">
          <div>
            <span className="mono block text-primary mb-5">
              Generative engine optimization
            </span>
            <h1 className="text-[clamp(2.5rem,4.8vw,4.1rem)] mb-6 text-pretty">
              Know when AI answers cite your brand.
            </h1>
            <p className="text-lg font-light text-muted max-w-[520px] mb-10 text-pretty">
              Track citations and mentions across ChatGPT, Claude, Gemini, Grok,
              Perplexity, and Google AI Overviews — in any language, from any
              location. Open source, with {FREE_CREDITS} free checks to start.
            </p>

            {error && (
              <div className="mb-6 max-w-[520px] px-4 py-3 border border-accent/40 bg-accent/8 rounded-[2px] text-sm text-accent">
                Sign-up is closed for now — all early-access seats are taken.
                Already have an account? Signing in still works.
              </div>
            )}

            <div className="flex gap-3.5 flex-wrap items-center">
              <GoogleSignIn />
              {seatsLeft !== null ? (
                full ? (
                  <span className="tag tag-red">All {cap} early-access seats taken</span>
                ) : (
                  <span className="tag tag-green">
                    {seatsLeft} of {cap} early-access seats left
                  </span>
                )
              ) : null}
            </div>
            <p className="text-sm text-muted mt-4">
              No card required · bring your own keys anytime
              {full && " · existing accounts can still sign in"}
            </p>
          </div>

          <div className="border border-line rounded-[2px] bg-bg-alt p-10">
            <span className="mono block text-muted mb-6">Engines covered</span>
            <ul className="flex flex-col">
              {ENGINES.map((e, i) => (
                <li
                  key={e.id}
                  className="flex items-baseline gap-5 py-3.5 border-b border-line last:border-b-0"
                >
                  <span className="mono text-primary w-6 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{e.label}</span>
                  <span className="ml-auto mono text-muted">
                    {e.id === "ai-overview" ? "serp capture" : "native web search"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
