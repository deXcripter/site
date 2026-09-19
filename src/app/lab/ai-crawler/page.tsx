import { headers } from "next/headers";
import CrawlerProbe from "@/components/crawler-probe";
import CrawlerTerminal from "@/components/crawler-terminal";
import { pageMeta } from "@/lib/site";
import { stagger } from "@/lib/motion";

export const metadata = pageMeta({
  title: "AI crawler rendering test",
  description:
    "A live test page that records which AI crawlers request it and which of them actually execute JavaScript. Logs are public.",
  path: "/lab/ai-crawler",
});

// Must not be cached: every request needs to reach the proxy and receive a
// fresh crawl id, otherwise repeat visits collapse into one logged hit.
export const dynamic = "force-dynamic";

export default async function AiCrawlerLabPage() {
  const headerList = await headers();
  const crawlId = headerList.get("x-crawl-id") ?? "unknown";

  return (
    <div className="mx-auto max-w-2xl pt-24 pb-24 sm:pt-32">
      <header className="rise">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Lab</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          Which AI crawlers actually execute JavaScript?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-pretty text-muted">
          This page carries three blocks of text. One is in the HTML. Two exist only if
          JavaScript runs. Every request is logged at the network edge, before any
          rendering happens, so a crawler that reads the HTML and skips the script leaves
          a visible gap. The log is public, below.
        </p>
      </header>

      <section className="rise mt-10 rounded-xl border border-line bg-surface p-5" style={stagger(1)}>
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
          Block A — server-rendered HTML
        </p>
        <p className="mt-3 text-lg leading-relaxed text-pretty">
          <span data-probe="static">
            This sentence is present in the raw HTML response. Every crawler that
            requests this URL can read it without running any code.
          </span>
        </p>
      </section>

      <div className="rise" style={stagger(2)}>
        <CrawlerProbe crawlId={crawlId} />
      </div>

      <section className="rise mt-10 border-t border-line pt-8" style={stagger(3)}>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">How to read the log</h2>
        <ul className="mt-4 space-y-3 text-base leading-relaxed text-muted">
          <li>
            <span className="text-fg">edge</span> means the bot requested the page. This is
            recorded before rendering, so it captures every crawler.
          </li>
          <li>
            <span className="text-fg">js-fetch</span> means the bot ran the script and
            called back to the server. Only renderers appear here.
          </li>
          <li>
            A bot with edge hits and zero js-fetch hits read the HTML and ignored the
            JavaScript. That is the finding this page exists to measure.
          </li>
          <li>
            <span className="text-fg">verified</span> marks a request whose address falls
            inside a range the vendor publishes for its own crawlers. User agents are
            trivially spoofed, so only verified hits can support a claim about what a
            given bot does.
          </li>
          <li>
            <span className="text-fg">unverifiable</span> is a separate state, used when a
            vendor publishes no ranges at all. It means the claim could not be checked
            either way — not that the bot is fake.
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-faint">
          No IP addresses, cookies or visitor identifiers are stored. Addresses are
          compared against the published ranges at request time and then discarded; only
          the verdict is kept, alongside the user agent, request path, bot label, network
          operator and country.
        </p>
      </section>

      <CrawlerTerminal />
    </div>
  );
}
