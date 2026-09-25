"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import CrawlerView from "@/components/crawler-view";
import type { Check, CheckStatus, CrawlerReport, Report } from "@/lib/visibility/analyze";

/** The field shows a fixed `https://` prefix, so any scheme pasted or typed is dropped. */
const stripScheme = (value: string) => value.replace(/^\s*(https?:)?\/\//i, "").trimStart();

const STEPS = [
  "Fetching the page",
  "Reading robots.txt",
  "Requesting as ChatGPT-User, GPTBot, ClaudeBot and PerplexityBot",
  "Rebuilding the page without JavaScript",
  "Scoring",
];

const STATUS_STYLE: Record<CheckStatus, { glyph: string; label: string; className: string }> = {
  pass: { glyph: "✓", label: "Pass", className: "text-emerald-700 dark:text-emerald-400" },
  warn: { glyph: "!", label: "Warning", className: "text-amber-700 dark:text-amber-300" },
  fail: { glyph: "✕", label: "Problem", className: "text-red-700 dark:text-red-400" },
  info: { glyph: "i", label: "Note", className: "text-muted" },
};

const KIND_LABEL: Record<CrawlerReport["kind"], string> = {
  search: "AI search",
  "on-demand": "User fetch",
  training: "Training",
};

const GROUPS: { id: Check["group"]; title: string }[] = [
  { id: "access", title: "Access" },
  { id: "content", title: "Content" },
  { id: "signals", title: "Signals" },
];

export default function VisibilityChecker() {
  const [value, setValue] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const run = async (target: string) => {
    const cleaned = stripScheme(target).trim();
    if (!cleaned) {
      setError("Enter a domain or URL to check.");
      return;
    }

    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;

    setValue(cleaned);
    setLoading(true);
    setError(null);
    setReport(null);
    setStep(0);

    // Shareable: the address bar carries the checked URL.
    const params = new URLSearchParams({ url: cleaned });
    window.history.replaceState(null, "", `?${params}`);

    try {
      const res = await fetch(`/api/visibility?${params}`, { signal: abort.signal, cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `The check failed (HTTP ${res.status})`);
      setReport(data as Report);
      requestAnimationFrame(() => resultsRef.current?.focus({ preventScroll: true }));
    } catch (err) {
      if (abort.signal.aborted) return;
      setError(err instanceof Error ? err.message : "The check failed.");
    } finally {
      if (controller.current === abort) setLoading(false);
    }
  };

  // Run a check straight away when the page is opened from a shared link.
  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("url");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of the initial URL
    if (shared) void run(shared);
    return () => controller.current?.abort();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(timer);
  }, [loading]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(value);
  };

  return (
    <div>
      <form onSubmit={onSubmit} className="mt-10" noValidate>
        <label htmlFor="visibility-url" className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
          Website or page URL
        </label>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-line bg-surface transition-colors focus-within:border-accent">
            <span className="shrink-0 pl-4 font-mono text-sm text-faint select-none" aria-hidden="true">
              https://
            </span>
            <input
              id="visibility-url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="example.com"
              value={value}
              onChange={(e) => setValue(stripScheme(e.target.value))}
              className="w-full min-w-0 bg-transparent py-3 pr-4 pl-0.5 font-mono text-sm text-fg outline-none placeholder:text-faint focus-visible:outline-none"
              aria-describedby="visibility-hint"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-xl bg-fg px-5 py-3 text-sm font-medium text-bg transition-opacity hover:opacity-85 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Check visibility"}
          </button>
        </div>
        <p id="visibility-hint" className="mt-2 text-sm text-faint">
          A domain or a specific page. 
        </p>
      </form>

      <div aria-live="polite">
        {loading && (
          <div className="mt-8 rounded-xl border border-line bg-surface p-5">
            <ol className="space-y-2 font-mono text-xs">
              {STEPS.map((label, i) => (
                <li
                  key={label}
                  className={i < step ? "text-muted" : i === step ? "text-fg" : "text-faint"}
                >
                  <span className="inline-block w-5">{i < step ? "✓" : i === step ? "›" : "·"}</span>
                  {label}
                  {i === step && <span className="animate-pulse">…</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && !loading && (
          <p role="alert" className="mt-8 rounded-xl border border-line bg-surface p-5 text-base text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {report && !loading && (
        // Focused so keyboard and screen-reader users land on the results. The
        // global :focus-visible ring is unlayered and would beat a utility class.
        <div ref={resultsRef} tabIndex={-1} style={{ outline: "none" }}>
          <Results report={report} />
        </div>
      )}
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 80) return { text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-600 dark:bg-emerald-400" };
  if (score >= 50) return { text: "text-amber-700 dark:text-amber-300", bar: "bg-amber-500 dark:bg-amber-300" };
  return { text: "text-red-700 dark:text-red-400", bar: "bg-red-600 dark:bg-red-400" };
}

function Results({ report }: { report: Report }) {
  const tone = scoreTone(report.score);
  const final = new URL(report.finalUrl);
  const counts = report.checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { pass: 0, warn: 0, fail: 0, info: 0 } as Record<CheckStatus, number>,
  );

  return (
    <div className="mt-10 space-y-12">
      {/* Score */}
      <section className="rise rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">AI visibility score</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-6xl font-semibold tracking-[-0.04em] tabular-nums ${tone.text}`}>
                {report.score}
              </span>
              <span className="text-lg text-faint">/ 100</span>
            </p>
          </div>
          <p className="font-mono text-xs text-muted">
            <span className="text-red-700 dark:text-red-400">{counts.fail} problems</span> ·{" "}
            <span className="text-amber-700 dark:text-amber-300">{counts.warn} warnings</span> ·{" "}
            <span className="text-emerald-700 dark:text-emerald-400">{counts.pass} passed</span>
          </p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${report.score}%` }} />
        </div>
        <p className="mt-4 text-lg leading-relaxed text-pretty">{report.summary}</p>
        <p className="mt-2 font-mono text-xs text-muted">
          <span className="break-all">
            {final.host}
            {final.pathname !== "/" ? final.pathname : ""}
          </span>{" "}
          · <span className="whitespace-nowrap">HTTP {report.page.status}</span> ·{" "}
          <span className="whitespace-nowrap">{report.page.ms} ms</span>
          {report.page.redirects.length > 0 &&
            ` · ${report.page.redirects.length} redirect${report.page.redirects.length === 1 ? "" : "s"}`}
        </p>
      </section>

      <CrawlerView report={report} />

      {/* Findings */}
      <section>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Findings</h2>
        <div className="mt-5 space-y-8">
          {GROUPS.map((group) => {
            const items = report.checks.filter((c) => c.group === group.id);
            if (items.length === 0) return null;
            return (
              <div key={group.id}>
                <h3 className="font-mono text-xs tracking-[0.14em] text-muted uppercase">{group.title}</h3>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {items.map((check) => {
                    const style = STATUS_STYLE[check.status];
                    return (
                      <li key={check.id} className="flex gap-3 py-4">
                        <span
                          className={`mt-0.5 w-4 shrink-0 text-center font-mono text-sm font-medium ${style.className}`}
                          title={style.label}
                        >
                          <span aria-hidden="true">{style.glyph}</span>
                          <span className="sr-only">{style.label}:</span>
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-pretty">{check.title}</p>
                          <p className="mt-1 text-sm leading-relaxed break-words text-pretty text-muted">
                            {check.detail}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Crawlers */}
      <section>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">Crawler by crawler</h2>
        <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
          robots.txt rules for this exact URL. Four crawlers were also sent a live request with their real user
          agent. A live block from our server is a strong hint, not proof: a firewall that verifies crawler IPs
          rejects our imitation but still lets the real bot in.
        </p>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {report.crawlers.map((crawler) => (
            <CrawlerRow key={crawler.token} crawler={crawler} />
          ))}
        </ul>
        <p className="mt-3 font-mono text-xs text-faint">
          robots.txt:{" "}
          {
            {
              found: "found",
              missing: `not found (HTTP ${report.robots.httpStatus}), everything allowed`,
              unreachable: "unreachable, crawlers assume everything is disallowed",
              html: "returns an HTML page, no rules served",
            }[report.robots.state]
          }
        </p>
      </section>

      <p className="font-mono text-xs text-faint">
        Checked {new Date(report.checkedAt).toLocaleString()} ·{" "}
        <a href={report.finalUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline underline-offset-4 hover:text-fg">
          open page
        </a>
      </p>
    </div>
  );
}

function CrawlerRow({ crawler }: { crawler: CrawlerReport }) {
  const { robots, live } = crawler;
  const liveStyle = STATUS_STYLE[
    ({ ok: "pass", reduced: "warn", blocked: "fail", error: "info" } as const)[live?.outcome ?? "error"]
  ];
  const liveLabel = { ok: "served", reduced: "reduced", blocked: "blocked", error: "no answer" }[
    live?.outcome ?? "error"
  ];

  return (
    <li className="grid gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm">{crawler.token}</span>
          <span className="text-xs text-faint">
            {crawler.vendor} · {KIND_LABEL[crawler.kind]}
            {crawler.tokenOnly && " · robots.txt token only"}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-muted text-pretty">{crawler.purpose}</p>
      </div>
      <div className="flex flex-col gap-0.5 font-mono text-xs sm:items-end sm:text-right">
        <span
          className={`break-all ${robots.allowed ? STATUS_STYLE.pass.className : STATUS_STYLE.fail.className}`}
          title={robots.rule ?? (robots.group ? `No rule matched in the ${robots.group} group` : "No group applies")}
        >
          {robots.allowed ? "✓ allowed" : "✕ blocked"}
          <span className="text-faint">
            {" "}
            {robots.rule ? `· ${robots.rule}` : robots.group === "*" ? "· via *" : ""}
          </span>
        </span>
        {live && (
          <span className={liveStyle.className} title={live.note}>
            live: {liveLabel}
            {live.status ? ` (${live.status})` : ""}
          </span>
        )}
      </div>
    </li>
  );
}
