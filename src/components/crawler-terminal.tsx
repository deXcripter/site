"use client";

import { useCallback, useEffect, useState } from "react";

type Hit = {
  ts: string;
  signal: string;
  bot_name: string;
  bot_vendor: string;
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
  requests: number;
  js_executions: number;
  verified_requests: number;
  last_seen: string;
};

/** Collapsible public log viewer. Closed by default to keep the page quiet. */
export default function CrawlerTerminal() {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crawler/logs?limit=150", { cache: "no-store" });
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
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="font-mono text-xs text-white/50">
              crawler_hits {loading ? "· syncing" : "· live"}
            </span>
            <button
              type="button"
              onClick={load}
              className="font-mono text-xs text-white/50 hover:text-white"
            >
              refresh
            </button>
          </div>

          <div className="max-h-[28rem] overflow-auto p-4 font-mono text-xs leading-relaxed">
            {error && <p className="text-red-400">error: {error}</p>}

            {!error && verdicts.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-white/40">── rendering verdict ──</p>
                {verdicts.map((v) => (
                  <p key={v.bot_name} className="whitespace-pre">
                    {v.bot_name.padEnd(22)}
                    {String(v.requests).padStart(5)} req
                    {String(v.js_executions).padStart(6)} js
                    {"  "}
                    <span className={v.js_executions > 0 ? "text-emerald-400" : "text-amber-400"}>
                      {v.js_executions > 0 ? "renders JS" : "no JS execution"}
                    </span>
                  </p>
                ))}
              </div>
            )}

            {!error && (
              <>
                <p className="mb-2 text-white/40">── recent hits ──</p>
                {hits.length === 0 && (
                  <p className="text-white/40">
                    no crawler hits recorded yet. bots typically take days to arrive.
                  </p>
                )}
                {hits.map((h, i) => (
                  <p key={`${h.ts}-${i}`} className="whitespace-pre-wrap break-all">
                    <span className="text-white/40">{h.ts}</span>{" "}
                    <span className={h.is_ai_bot ? "text-cyan-400" : "text-white/70"}>
                      {h.bot_name}
                    </span>{" "}
                    <span className="text-white/40">
                      [{h.signal}]{h.verified ? " ✓" : ""} {h.country} {h.path}
                    </span>
                  </p>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
