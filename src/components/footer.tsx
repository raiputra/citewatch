const AGENCY_URL =
  "https://raiputra.com?utm_source=aiseo-monitor&utm_medium=footer&utm_campaign=app";

export function Footer() {
  return (
    <footer className="border-t border-line bg-bg py-7 mt-auto">
      <div className="max-w-[1200px] mx-auto px-7 md:px-12 flex items-center justify-between gap-5 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <a
            href={AGENCY_URL}
            target="_blank"
            rel="noopener"
            className="font-serif text-[1.05rem] tracking-tight hover:text-primary transition-colors"
          >
            Raiputra
          </a>
          <span className="text-[0.8rem] text-muted">
            The AI SEO agency — we get brands cited by AI.
          </span>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          <a
            href="https://github.com/raiputra/citewatch"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[0.83rem] text-muted hover:text-ink transition-colors"
          >
            Open source
          </a>
          <a
            href={AGENCY_URL}
            target="_blank"
            rel="noopener"
            className="text-[0.88rem] font-medium text-primary inline-flex items-center gap-1.5 hover:gap-2.5 transition-[gap]"
          >
            Want us to improve these numbers? <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
