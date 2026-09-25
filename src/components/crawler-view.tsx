"use client";

import Link from "next/link";
import { useState } from "react";
import type { CrawlerReport, Report } from "@/lib/visibility/analyze";
import type { PageView, ViewBlock, ViewPart } from "@/lib/visibility/html";

type Mode = "reader" | "source";
type Tone = "pass" | "warn" | "fail" | "info";

const TONE: Record<Tone, string> = {
  pass: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-300",
  fail: "text-red-700 dark:text-red-400",
  info: "text-muted",
};

const DOT: Record<Tone, string> = {
  pass: "bg-emerald-600 dark:bg-emerald-400",
  warn: "bg-amber-500 dark:bg-amber-300",
  fail: "bg-red-600 dark:bg-red-400",
  info: "bg-faint",
};

/** What happened to one crawler, as a tone and a sentence, plus which view it got. */
function describe(crawler: CrawlerReport, report: Report): { tone: Tone; note: string; view: PageView | null } {
  const { token, robots, live } = crawler;
  const own = report.crawlerViews[token];

  if (report.robots.state === "unreachable") {
    return {
      tone: "fail",
      note: `robots.txt could not be fetched, and crawlers treat that as “keep out of the whole site” until it can be. Below is what ${token} would receive otherwise.`,
      view: own ?? report.view,
    };
  }

  if (!robots.allowed) {
    return {
      tone: "fail",
      note: `robots.txt disallows ${token} here${robots.rule ? ` (${robots.rule})` : ""}, so a crawler that follows the rules never fetches this page. Below is what it would receive if it did.`,
      view: own ?? report.view,
    };
  }

  switch (live?.outcome) {
    case "blocked":
      return own
        ? { tone: "fail", note: `The server turned ${token} away: ${live.note.toLowerCase()}. This is what it got instead.`, view: own }
        : { tone: "fail", note: `The server turned ${token} away: ${live.note.toLowerCase()}. No page came back at all.`, view: null };
    case "reduced":
      return { tone: "warn", note: `${token} was sent less than a browser. ${live.note}.`, view: own ?? report.view };
    case "error":
      return {
        tone: "info",
        note: `${token}'s request got no answer in time, so this shows the page a browser received.`,
        view: report.view,
      };
    default:
      return { tone: "pass", note: `${token} was sent the same page as a browser.`, view: report.view };
  }
}

export default function CrawlerView({ report }: { report: Report }) {
  const tested = report.crawlers.filter((c) => c.live);
  const [selected, setSelected] = useState(tested[0]?.token ?? "");
  const [mode, setMode] = useState<Mode>("reader");

  const crawler = tested.find((c) => c.token === selected);
  const state = crawler
    ? describe(crawler, report)
    : { tone: "info" as Tone, note: "Live crawler requests were not possible for this site, so this is the page a browser received.", view: report.view };
  const path = new URL(report.finalUrl).pathname;

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-[-0.02em]">How AI sees your page</h2>
      <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">
        The page rebuilt from the raw HTML response, before any JavaScript runs. That is the version most AI
        crawlers work from: no layout, no styling, no images, only the text and structure they can read, quote
        and cite.{" "}
        <Link href="/lab/ai-crawler" className="text-fg underline decoration-accent/50 underline-offset-4 hover:decoration-accent">
          Which ones run JavaScript?
        </Link>
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {tested.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Crawler">
            {tested.map((c) => {
              const tone = describe(c, report).tone;
              const active = c.token === selected;
              return (
                <button
                  key={c.token}
                  type="button"
                  onClick={() => setSelected(c.token)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
                    active ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${DOT[tone]}`} aria-hidden="true" />
                  {c.token}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex overflow-hidden rounded-full border border-line" role="group" aria-label="View">
          {(["reader", "source"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`px-3 py-1.5 font-mono text-xs transition-colors ${
                mode === m ? "bg-line text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {m === "reader" ? "Reader" : "HTML source"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 font-mono text-xs text-muted">
          <span className="min-w-0 break-all">
            GET {path}
            {crawler ? ` · as ${crawler.token}` : ""}
          </span>
          {state.view && mode === "reader" && (
            <span>{state.view.blocks.length.toLocaleString("en-US")} blocks</span>
          )}
        </div>

        <p className={`border-b border-line px-4 py-3 text-sm leading-relaxed text-pretty ${TONE[state.tone]}`}>
          {state.note}
        </p>

        <div className="max-h-[36rem] overflow-auto">
          {!state.view ? (
            <p className="p-5 text-sm text-faint">Nothing to show.</p>
          ) : mode === "source" ? (
            <pre className="p-4 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-muted">
              {state.view.source || "(empty response)"}
              {state.view.sourceTruncated && "\n\n… truncated"}
            </pre>
          ) : (
            <Reader view={state.view} report={report} usesOwnView={state.view !== report.view} />
          )}
        </div>
      </div>
    </section>
  );
}

function Reader({ view, report, usesOwnView }: { view: PageView; report: Report; usesOwnView: boolean }) {
  return (
    <div className="p-4 sm:p-5">
      {/* The title and description only describe the browser's page, not a block page. */}
      {!usesOwnView && (report.page.title || report.page.description) && (
        <div className="mb-5 border-b border-line pb-5">
          <Row label="title">
            <p className="font-medium text-pretty">{report.page.title ?? <Missing>no title</Missing>}</p>
          </Row>
          <Row label="desc">
            <p className="text-sm text-pretty text-muted">
              {report.page.description ?? <Missing>no meta description</Missing>}
            </p>
          </Row>
        </div>
      )}

      {view.blocks.length === 0 ? (
        <p className="text-sm leading-relaxed text-pretty text-muted">
          There is no readable text in this HTML. This is how a page that builds its content with JavaScript
          looks to a crawler that does not run it: empty.
        </p>
      ) : (
        <div className="space-y-2.5">
          {view.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </div>
      )}

      {view.truncated && (
        <p className="mt-5 font-mono text-xs text-faint">… the page continues; the view stops here.</p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-baseline gap-2">
      <span className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase select-none">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-amber-700 dark:text-amber-300">[{children}]</span>;
}

const HEADING_CLASS: Record<string, string> = {
  h1: "text-2xl font-semibold tracking-[-0.03em]",
  h2: "text-xl font-semibold tracking-[-0.02em]",
  h3: "text-lg font-semibold",
  h4: "font-semibold",
  h5: "font-semibold",
  h6: "font-semibold",
};

function Block({ block }: { block: ViewBlock }) {
  if (block.kind === "img") {
    return (
      <Row label="img">
        {block.alt ? (
          <p className="text-sm text-muted italic">{block.alt}</p>
        ) : (
          <Missing>image with no alt text, invisible to AI</Missing>
        )}
      </Row>
    );
  }

  const text = <Parts parts={block.parts} />;

  if (block.kind in HEADING_CLASS) {
    return (
      <Row label={block.kind}>
        <p className={`text-pretty ${HEADING_CLASS[block.kind]} ${block.kind !== "h1" ? "pt-2" : ""}`}>{text}</p>
      </Row>
    );
  }
  if (block.kind === "code") {
    return (
      <Row label="code">
        <pre className="overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-xs">{text}</pre>
      </Row>
    );
  }
  if (block.kind === "quote") {
    return (
      <Row label="quote">
        <p className="border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted">{text}</p>
      </Row>
    );
  }
  return (
    <Row label={block.kind === "li" ? "li" : "p"}>
      <p className="text-sm leading-relaxed text-pretty">
        {block.kind === "li" && <span className="text-faint">• </span>}
        {text}
      </p>
    </Row>
  );
}

/** Links are shown, not followed: the target is in the tooltip. */
function Parts({ parts }: { parts: ViewPart[] }) {
  return parts.map((part, i) =>
    part.href ? (
      <span
        key={i}
        title={part.href}
        className="underline decoration-accent/50 decoration-[1.5px] underline-offset-[0.2em]"
      >
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    ),
  );
}
