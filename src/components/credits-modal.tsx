"use client";

import { useEffect, useState, useTransition } from "react";
import { submitCreditRequest } from "@/app/actions";
import { ENGINES, CREDIT_VOLUMES } from "@/lib/constants";

export function CreditsModal() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        className="text-sm font-medium text-primary hover:text-primary-dk transition-colors cursor-pointer whitespace-nowrap"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
      >
        Need more credits?
      </button>

      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 z-200 flex items-center justify-center p-6 bg-[rgba(20,22,26,0.55)] backdrop-blur-[3px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.target === e.currentTarget && setOpen(false)}
      >
        <div
          className={`w-full max-w-[940px] max-h-[90vh] grid md:grid-cols-[1.1fr_0.9fr] rounded-[3px] overflow-hidden relative shadow-[0_24px_64px_rgba(20,22,26,0.22)] transition-transform duration-300 ${
            open ? "translate-y-0" : "translate-y-[18px]"
          }`}
        >
          <button
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-[2px] bg-white/12 text-white/75 hover:bg-white/22 hover:text-white transition-colors cursor-pointer max-md:bg-bg-card max-md:text-muted"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>

          {/* Form side */}
          <div className="bg-bg px-12 py-13 max-md:px-7 max-md:py-10 overflow-y-auto">
            <span className="mono block text-muted mb-3">Credits & feedback</span>
            <h2 className="text-[1.75rem] mb-9">Tell us what you need</h2>

            {sent ? (
              <div className="px-4 py-3.5 bg-primary/8 border border-primary/20 rounded-[2px] text-[0.88rem] font-medium text-primary">
                Thank you — we read every request. We&apos;ll reach out to your
                account email if we can help sooner.
              </div>
            ) : (
              <form
                className="flex flex-col gap-5.5"
                action={(fd) =>
                  startTransition(async () => {
                    await submitCreditRequest(fd);
                    setSent(true);
                  })
                }
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cr-volume" className="mono text-muted">
                    Credits you&apos;d use per month
                  </label>
                  <select
                    id="cr-volume"
                    name="monthlyCredits"
                    required
                    className="field"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {CREDIT_VOLUMES.map((v) => (
                      <option key={v} value={v}>
                        {v} checks / month
                      </option>
                    ))}
                  </select>
                </div>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mono text-muted mb-2">
                    Engines that matter most to you
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {ENGINES.map((e) => (
                      <label
                        key={e.id}
                        className="flex items-center gap-2.5 border border-line rounded-[2px] bg-white px-3.5 py-2.5 cursor-pointer has-checked:border-primary has-checked:bg-primary/5 transition-colors"
                      >
                        <input
                          type="checkbox"
                          name="topEngines"
                          value={e.id}
                          className="accent-primary"
                        />
                        <span className="text-[0.85rem] font-medium">{e.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cr-suggestions" className="mono text-muted">
                    What would make this tool better? (optional)
                  </label>
                  <textarea
                    id="cr-suggestions"
                    name="suggestions"
                    rows={3}
                    maxLength={2000}
                    placeholder="Scheduling, competitor tracking, reports, API…"
                    className="field resize-y leading-relaxed"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="servicesInterest"
                    className="accent-primary mt-1"
                  />
                  <span className="text-[0.88rem] text-muted">
                    I&apos;m interested in Raiputra&apos;s managed AI SEO services —
                    reach out to me.
                  </span>
                </label>

                <button
                  type="submit"
                  className="btn btn-primary self-start mt-1"
                  disabled={pending}
                >
                  {pending ? "Sending…" : "Send request"}
                </button>
              </form>
            )}
          </div>

          {/* Info side */}
          <div className="bg-primary px-11 py-13 max-md:hidden flex flex-col justify-between">
            <div>
              <span className="font-serif text-xl text-white block mb-1.5 tracking-tight">
                Citewatch
              </span>
              <span className="text-[0.88rem] text-white/50 font-light">
                by Raiputra
              </span>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <span className="mono block text-white/40 mb-1.5">
                  Unlimited today
                </span>
                <p className="text-[0.95rem] text-white font-medium leading-relaxed">
                  Bring your own API keys in Settings and checks for those
                  providers never consume credits.
                </p>
              </div>
              <div>
                <span className="mono block text-white/40 mb-1.5">
                  Why we ask
                </span>
                <p className="text-[0.85rem] text-white/60 leading-relaxed">
                  This tool is free and open source. Your volume and feedback
                  decide what we build and how we price larger plans.
                </p>
              </div>
            </div>

            <p className="text-[0.85rem] text-white/48 leading-relaxed border-t border-white/12 pt-6">
              We reply from raiputra.com — no spam, no sharing your data.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
