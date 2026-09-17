"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type BotKind = "training" | "on-demand" | "search" | "other";

type Hit = {
  ts: string;
  signal: string;
  bot_name: string;
  bot_vendor: string;
  kind: BotKind;
  is_ai_bot: number;
  verified: number;
  asn_org: string;
  country: string;
  path: string;
  user_agent: string;
};

type Verdict = {
  bot_name: string;
  bot_vendor: string;
  kind: BotKind;
  is_ai_bot: number;
  requests: number;
  js_executions: number;
  verified_requests: number;
  last_seen: string;
};

type Filter = "ai" | "all";

/**
 * Visual key for each bot category.
 *
 * A glyph carries the distinction as well as the colour, so the categories stay
 * legible without relying on colour perception alone.
 */
const KIND_STYLE: Record<BotKind, { tag: string; className: string; label: string }> = {
  training: {
    tag: "◆ AI",
    className: "text-cyan-400",
    label: "AI crawler, builds training data and indexes",
  },
  "on-demand": {
    tag: "◈ AI-LIVE",
    className: "text-violet-400",
    label: "AI fetcher, triggered when a user asks about a URL",
  },
  search: {
    tag: "○ SEARCH",
    className: "text-amber-300",
    label: "Classic search engine crawler",
  },
  other: {
    tag: "· TOOL",
    className: "text-white/45",
    label: "Headless browser, auditing tool or unidentified bot",
  },
};

export default function CrawlerTerminal() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("ai");
  const [hits, setHits] = useState<Hit[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crawler/logs?limit=250", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setHits(data.hits ?? []);
      setVerdicts(data.verdicts ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // The first fetch is triggered by the toggle below; this effect only keeps
  // the view refreshing while the panel stays open.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [open, load]);

  const toggle = () => {
    setOpen((wasOpen) => {
      if (!wasOpen) void load();
      return !wasOpen;
    });
  };

  const aiOnly = filter === "ai";
  const visibleHits = useMemo(
    () => (aiOnly ? hits.filter((h) => h.is_ai_bot === 1) : hits),
    [hits, aiOnly],
  );
  const visibleVerdicts = useMemo(
    () => (aiOnly ? verdicts.filter((v) => v.is_ai_bot === 1) : verdicts),
    [verdicts, aiOnly],
  );

  const aiCount = hits.filter((h) => h.is_ai_bot === 1).length;

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={toggle}
        className="font-mono text-xs tracking-[0.14em] text-muted uppercase transition-colors hover:text-fg"
        aria-expanded={open}
      >
        {open ? "▾ hide live log" : "▸ show live log"}
      </button>

      {open && (
        <div className="mt-4 overflow-hidden rounded-xl border border-line bg-[#0a0a0a] text-[#f2f1ed]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
            <span className="font-mono text-xs text-white/50">
              crawler_hits {loading ? "· syncing" : "· live"}
            </span>

            <div className="flex items-center gap-3">
              <div
                className="flex overflow-hidden rounded-md border border-white/15"
                role="group"
                aria-label="Filter log entries"
              >
                <button
                  type="button"
                  onClick={() => setFilter("ai")}
                  aria-pressed={aiOnly}
                  className={`px-2.5 py-1 font-mono text-xs transition-colors ${
                    aiOnly ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  AI only ({aiCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  aria-pressed={!aiOnly}
                  className={`px-2.5 py-1 font-mono text-xs transition-colors ${
                    !aiOnly ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  All bots ({hits.length})
                </button>
              </div>

              <button
                type="button"
                onClick={load}
                className="font-mono text-xs text-white/50 hover:text-white"
              >
                refresh
              </button>
            </div>
          </div>

          <div className="max-h-[30rem] overflow-auto p-4 font-mono text-xs leading-relaxed">
            {error && <p className="text-red-400">error: {error}</p>}

            {!error && (
              <>
                {visibleVerdicts.length > 0 && (
                  <div className="mb-5">
                    <p className="mb-2 text-white/40">── rendering verdict ──</p>
                    {visibleVerdicts.map((v) => {
                      const style = KIND_STYLE[v.kind] ?? KIND_STYLE.other;
                      return (
                        <p key={v.bot_name} className="whitespace-pre-wrap">
                          <span className={`${style.className} inline-block w-[5.5rem]`}>
                            {style.tag}
                          </span>
                          <span className="inline-block w-[13rem]">{v.bot_name}</span>
                          {String(v.requests).padStart(4)} req
                          {String(v.js_executions).padStart(5)} js{"  "}
                          <span
                            className={
                              v.js_executions > 0 ? "text-emerald-400" : "text-amber-400"
                            }
                          >
                            {v.js_executions > 0 ? "renders JS" : "no JS execution"}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                )}

                <p className="mb-2 text-white/40">
                  ── recent hits{aiOnly ? " · AI only" : " · all bots"} ──
                </p>

                {visibleHits.length === 0 && (
                  <p className="text-white/40">
                    {hits.length === 0
                      ? "no crawler hits recorded yet. bots typically take days to arrive."
                      : "no AI crawler hits yet. switch to All bots to see search engines and tooling."}
                  </p>
                )}

                {visibleHits.map((h, i) => {
                  const style = KIND_STYLE[h.kind] ?? KIND_STYLE.other;
                  return (
                    <p
                      key={`${h.ts}-${h.bot_name}-${i}`}
                      className="whitespace-pre-wrap break-all"
                      title={style.label}
                    >
                      <span className="text-white/40">{h.ts}</span>{" "}
                      <span className={style.className}>{style.tag}</span>{" "}
                      <span className="text-white/85">{h.bot_name}</span>{" "}
                      <span className="text-white/40">
                        [{h.signal}]
                        {h.verified ? (
                          <span className="text-emerald-400"> verified</span>
                        ) : (
                          <span className="text-white/30"> unverified</span>
                        )}
                        {h.country ? ` ${h.country}` : ""} {h.path}
                      </span>
                    </p>
                  );
                })}

                <div className="mt-5 border-t border-white/10 pt-3 text-white/40">
                  <p className="mb-1">── key ──</p>
                  {(Object.keys(KIND_STYLE) as BotKind[]).map((kind) => (
                    <p key={kind}>
                      <span className={`${KIND_STYLE[kind].className} inline-block w-[5.5rem]`}>
                        {KIND_STYLE[kind].tag}
                      </span>
                      {KIND_STYLE[kind].label}
                    </p>
                  ))}
                  <p className="mt-2">
                    Human visitors are never recorded here; only requests identified as bots.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
