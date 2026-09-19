"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BotKind = "training" | "on-demand" | "search" | "monitor" | "other";

type Hit = {
  /** Opaque keyset position, also this row's identity when merging refreshes. */
  cursor: string;
  ts: string;
  signal: string;
  bot_name: string;
  bot_vendor: string;
  kind: BotKind;
  is_ai_bot: number;
  verified: number;
  verify_status: string;
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
  verified_js_executions: number;
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
  monitor: {
    tag: "· UPTIME",
    className: "text-white/30",
    label: "Uptime monitor, not a crawler (hidden from both views)",
  },
  other: {
    tag: "· TOOL",
    className: "text-white/45",
    label: "Headless browser, auditing tool or unidentified bot",
  },
};

/**
 * How a hit's identity claim was checked.
 *
 * "unverified" and "unverifiable" are kept apart on purpose: the first means
 * the vendor publishes ranges and this address was not in them, the second
 * that the vendor publishes nothing to check against. Collapsing them is what
 * made an earlier version of this log read as though every AI bot were fake.
 */
const VERIFY_STYLE: Record<
  string,
  { label: string; className: string; title: string }
> = {
  verified: {
    label: "verified",
    className: "text-emerald-400",
    title: "Address is inside a range this vendor publishes for its crawlers.",
  },
  unverified: {
    label: "unverified",
    className: "text-red-400",
    title:
      "This vendor publishes crawler ranges and the address was not in them. Probable impostor.",
  },
  unverifiable: {
    label: "unverifiable",
    className: "text-white/30",
    title:
      "This vendor publishes no crawler IP ranges, so the claim cannot be checked either way.",
  },
  "no-ip": {
    label: "no client ip",
    className: "text-white/30",
    title: "The platform exposed no client address, so no check was possible.",
  },
};

const LEGACY_VERIFY = {
  label: "not checked",
  className: "text-white/25",
  title: "Logged before range checking existed.",
};

/** Rows per request. The log is paged rather than capped at a fixed ceiling. */
const PAGE_SIZE = 50;

export default function CrawlerTerminal() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("ai");
  const [hits, setHits] = useState<Hit[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [totals, setTotals] = useState<{ ai: number; crawlers: number } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const aiOnly = filter === "ai";

  const endpoint = useCallback(
    (which: Filter, cursor?: string) =>
      `/api/crawler/logs?limit=${PAGE_SIZE}&filter=${which}` +
      (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""),
    [],
  );

  /**
   * First page: replaces everything. Used on open and whenever the filter
   * changes. The filter is passed in rather than read from state, because the
   * caller that changes it would otherwise close over the previous value.
   */
  const loadFirst = useCallback(async (which: Filter) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint(which), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setHits(data.hits ?? []);
      setNextCursor(data.nextCursor ?? null);
      setVerdicts(data.verdicts ?? []);
      if (data.totals) setTotals(data.totals);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  /** Next page: appends. Driven by the scroll sentinel below. */
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(endpoint(filter, nextCursor), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      setHits((prev) => {
        // The cursor makes this exact, but a duplicate would be harmless to
        // drop and ugly to render, so guard anyway.
        const seen = new Set(prev.map((h) => h.cursor));
        return [...prev, ...(data.hits ?? []).filter((h: Hit) => !seen.has(h.cursor))];
      });
      setNextCursor(data.nextCursor ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoadingMore(false);
    }
  }, [endpoint, filter, nextCursor, loadingMore]);

  /**
   * Periodic refresh, which only ever prepends.
   *
   * Replacing the list would throw away every page the reader had scrolled
   * through, so this merges genuinely new rows at the top and leaves the
   * loaded pages and the cursor alone.
   */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(endpoint(filter), { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;

      setHits((prev) => {
        if (prev.length === 0) return data.hits ?? [];
        const seen = new Set(prev.map((h) => h.cursor));
        const fresh = (data.hits ?? []).filter((h: Hit) => !seen.has(h.cursor));
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
      if (data.verdicts) setVerdicts(data.verdicts);
      if (data.totals) setTotals(data.totals);
    } catch {
      // A failed background refresh is not worth surfacing; the next tick retries.
    }
  }, [endpoint, filter]);

  // The first fetch is triggered by the toggle below; this effect only keeps
  // the view refreshing while the panel stays open.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [open, refresh]);

  // Infinite scroll: fetch the next batch once the sentinel at the bottom of
  // the list comes into view inside the scroll container.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!open || !sentinel || !root || !nextCursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      // Start fetching slightly before the sentinel is actually visible so the
      // next batch is usually there by the time the reader reaches it.
      { root, rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, nextCursor, loadMore]);

  const toggle = () => {
    setOpen((wasOpen) => {
      if (!wasOpen) void loadFirst(filter);
      return !wasOpen;
    });
  };

  /**
   * Re-queries instead of filtering in the browser, so a narrow view pages
   * through the whole log rather than only whatever happened to be loaded.
   */
  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setFilter(next);
    setHits([]);
    setNextCursor(null);
    void loadFirst(next);
  };

  const visibleHits = hits;
  const visibleVerdicts = useMemo(
    () =>
      (aiOnly ? verdicts.filter((v) => v.is_ai_bot === 1) : verdicts).filter(
        (v) => v.kind !== "monitor",
      ),
    [verdicts, aiOnly],
  );

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
                  onClick={() => changeFilter("ai")}
                  aria-pressed={aiOnly}
                  className={`px-2.5 py-1 font-mono text-xs transition-colors ${
                    aiOnly ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  AI only{totals ? ` (${totals.ai})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => changeFilter("all")}
                  aria-pressed={!aiOnly}
                  className={`px-2.5 py-1 font-mono text-xs transition-colors ${
                    !aiOnly ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                  }`}
                >
                  All crawlers{totals ? ` (${totals.crawlers})` : ""}
                </button>
              </div>

              <button
                type="button"
                onClick={() => void loadFirst(filter)}
                className="font-mono text-xs text-white/50 hover:text-white"
              >
                refresh
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="max-h-[30rem] overflow-auto p-4 font-mono text-xs leading-relaxed"
          >
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
                              v.verified_js_executions > 0
                                ? "text-emerald-400"
                                : v.js_executions > 0
                                  ? "text-amber-400"
                                  : "text-amber-400"
                            }
                            title={
                              v.js_executions > 0 && v.verified_js_executions === 0
                                ? "JavaScript ran, but no such request passed the published-range check, so it cannot be attributed to this vendor."
                                : "Based only on requests whose address matched the vendor's published ranges."
                            }
                          >
                            {v.verified_js_executions > 0
                              ? "renders JS"
                              : v.js_executions > 0
                                ? "renders JS (unverified source)"
                                : "no JS execution"}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                )}

                <p className="mb-2 text-white/40">
                  ── recent hits{aiOnly ? " · AI only" : " · all crawlers"} ──
                </p>

                {visibleHits.length === 0 && !loading && (
                  <p className="text-white/40">
                    {aiOnly
                      ? "no AI crawler hits yet. switch to All crawlers to see search engines and tooling."
                      : "no crawler hits recorded yet. bots typically take days to arrive."}
                  </p>
                )}

                {visibleHits.map((h) => {
                  const style = KIND_STYLE[h.kind] ?? KIND_STYLE.other;
                  const verify = VERIFY_STYLE[h.verify_status] ?? LEGACY_VERIFY;
                  return (
                    <p
                      key={h.cursor}
                      className="whitespace-pre-wrap break-all"
                      title={style.label}
                    >
                      <span className="text-white/40">{h.ts}</span>{" "}
                      <span className={style.className}>{style.tag}</span>{" "}
                      <span className="text-white/85">{h.bot_name}</span>{" "}
                      <span className="text-white/40">
                        [{h.signal}]
                        <span className={verify.className} title={verify.title}>
                          {" "}
                          {verify.label}
                        </span>
                        {h.country ? ` ${h.country}` : ""} {h.path}
                      </span>
                    </p>
                  );
                })}

                {/*
                  * Scroll sentinel. Crossing it inside the scroll container
                  * fetches the next batch, so the log reads as one continuous
                  * list instead of being cut off at a fixed ceiling.
                  */}
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />

                {nextCursor && (
                  <p className="mt-3 text-white/40">
                    {loadingMore ? (
                      "loading more…"
                    ) : (
                      <button
                        type="button"
                        onClick={() => void loadMore()}
                        className="underline underline-offset-4 hover:text-white"
                      >
                        load {PAGE_SIZE} more
                      </button>
                    )}
                  </p>
                )}

                {visibleHits.length > 0 && (
                  <p className="mt-3 text-white/30">
                    showing {visibleHits.length}
                    {totals
                      ? ` of ${aiOnly ? totals.ai : totals.crawlers}`
                      : ""}
                    {!nextCursor && " · end of log"}
                  </p>
                )}

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
                  <p className="mt-3 mb-1">── verification ──</p>
                  {(["verified", "unverified", "unverifiable"] as const).map((key) => (
                    <p key={key}>
                      <span
                        className={`${VERIFY_STYLE[key].className} inline-block w-[5.5rem]`}
                      >
                        {VERIFY_STYLE[key].label}
                      </span>
                      {VERIFY_STYLE[key].title}
                    </p>
                  ))}
                  <p className="mt-2">
                    Checked against each vendor&apos;s published crawler IP ranges. Addresses
                    are used for the check and discarded; only the verdict is stored.
                  </p>
                  <p className="mt-2">
                    Human visitors are never recorded here; only requests identified as bots.
                    Uptime monitors are excluded from both views.
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
