import { ENGINES, LANGUAGES, COUNTRIES } from "@/lib/constants";

type Defaults = {
  query?: string;
  language?: string;
  country?: string;
  brandName?: string;
  brandDomain?: string;
  engines?: string[];
};

export function PromptForm({
  action,
  defaults = {},
  submitLabel,
  promptId,
}: {
  action: (formData: FormData) => Promise<void>;
  defaults?: Defaults;
  submitLabel: string;
  promptId?: string;
}) {
  const checkedEngines = defaults.engines ?? ENGINES.filter((e) => e.id !== "ai-overview").map((e) => e.id);

  return (
    <form action={action} className="flex flex-col gap-6">
      {promptId && <input type="hidden" name="promptId" value={promptId} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="query" className="mono text-muted">
          Prompt / question
        </label>
        <textarea
          id="query"
          name="query"
          required
          minLength={3}
          maxLength={500}
          rows={3}
          placeholder="e.g. apa software akuntansi terbaik untuk UMKM?"
          className="field resize-y leading-relaxed"
          defaultValue={defaults.query}
        />
      </div>

      <div className="grid grid-cols-2 gap-4.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="language" className="mono text-muted">
            Language
          </label>
          <select
            id="language"
            name="language"
            required
            className="field"
            defaultValue={defaults.language ?? "en"}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="country" className="mono text-muted">
            Location
          </label>
          <select
            id="country"
            name="country"
            required
            className="field"
            defaultValue={defaults.country ?? "US"}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="brandName" className="mono text-muted">
            Brand name
          </label>
          <input
            id="brandName"
            name="brandName"
            required
            maxLength={120}
            placeholder="Acme"
            className="field"
            defaultValue={defaults.brandName}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="brandDomain" className="mono text-muted">
            Brand domain
          </label>
          <input
            id="brandDomain"
            name="brandDomain"
            required
            maxLength={200}
            placeholder="acme.com"
            className="field"
            defaultValue={defaults.brandDomain}
          />
          <span className="text-xs text-muted">
            No https:// or www needed — subdomains like blog.acme.com count as
            citations too.
          </span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mono text-muted mb-2.5">Engines to check</legend>
        <div className="grid grid-cols-2 gap-2.5">
          {ENGINES.map((e) => (
            <label
              key={e.id}
              className="flex items-center gap-3 border border-line rounded-[2px] bg-white px-4 py-3 cursor-pointer has-checked:border-primary has-checked:bg-primary/5 transition-colors"
            >
              <input
                type="checkbox"
                name="engines"
                value={e.id}
                defaultChecked={checkedEngines.includes(e.id)}
                className="accent-primary"
              />
              <span className="text-sm font-medium">{e.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn-primary self-start mt-1.5">
        {submitLabel}
      </button>
    </form>
  );
}
