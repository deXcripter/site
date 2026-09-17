"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Client-side probes for the crawler experiment.
 *
 * Block B renders a constant once mounted. It proves script execution but is
 * invisible to the server, so only a JS-based tracker can observe it.
 *
 * Block C calls the logging endpoint. It is the only client-side signal the
 * server can record, which makes it the actual proof of rendering.
 */
/** Reports false during server render, true once hydrated on the client. */
const subscribe = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export default function CrawlerProbe({ crawlId }: { crawlId: string }) {
  const mounted = useHydrated();
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crawler/text?rid=${encodeURIComponent(crawlId)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { text: string }) => {
        if (!cancelled) setText(data.text);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [crawlId]);

  return (
    <>
      <section className="mt-8 rounded-xl border border-line bg-surface p-5">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
          Block B — injected by JavaScript
        </p>
        <p className="mt-3 text-lg leading-relaxed text-pretty">
          {mounted ? (
            <span data-probe="js-injected">
              This sentence was written into the page by client-side JavaScript.
              If you can read it, the script ran.
            </span>
          ) : (
            <span className="text-faint">Waiting for script execution…</span>
          )}
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-5">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
          Block C — fetched from the server by JavaScript
        </p>
        <p className="mt-3 text-lg leading-relaxed text-pretty">
          {text ? (
            <span data-probe="js-fetch">{text}</span>
          ) : failed ? (
            <span className="text-faint">Probe request failed.</span>
          ) : (
            <span className="text-faint">Requesting random text…</span>
          )}
        </p>
      </section>
    </>
  );
}
