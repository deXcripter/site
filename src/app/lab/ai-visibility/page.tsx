import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import VisibilityChecker from "@/components/visibility-checker";
import { pageMeta } from "@/lib/site";
import { stagger } from "@/lib/motion";

export const metadata = pageMeta({
  title: "AI crawler visibility checker",
  description:
    "Check whether ChatGPT, Claude, Perplexity and other AI crawlers can reach and read your website: robots.txt, firewall blocks, noindex and JavaScript-only content.",
  path: "/lab/ai-visibility",
});

export default function AiVisibilityPage() {
  return (
    <div className="mx-auto max-w-2xl pt-24 pb-24 sm:pt-32">
      <header className="rise">
        <nav aria-label="Breadcrumb">
          <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
            <Link href="/lab" className="transition-colors hover:text-fg">
              Lab
            </Link>
            <span className="mx-2 text-line">/</span>
            <span className="text-fg">AI Visibility</span>
          </p>
        </nav>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          Can AI crawlers see your website?
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-pretty text-muted">
          Enter a URL and this checks it the way GPTBot, ClaudeBot, PerplexityBot and the rest would. It
          looks at whether they are allowed in, whether the server lets them through, and whether there is
          any text for them to read once they arrive.
        </p>
      </header>

      <div className="rise" style={stagger(1)}>
        <VisibilityChecker />
      </div>

      <section className="rise mt-16 border-t border-line pt-8" style={stagger(2)}>
        <h2 className="text-xl font-semibold tracking-[-0.02em]">What gets checked</h2>
        <ul className="mt-4 space-y-3 text-base leading-relaxed text-muted">
          <li>
            <span className="text-fg">robots.txt</span>, evaluated per crawler for the exact URL, with the
            same group and longest-match rules the crawlers use. A bot with its own group ignores the{" "}
            <span className="font-mono text-sm">*</span> group entirely, which trips up a lot of sites.
          </li>
          <li>
            <span className="text-fg">Firewall and CDN blocks.</span> The page is requested as a browser,
            then again as four AI crawlers. A refusal, a challenge page or much thinner content for the bots
            shows up here, even though robots.txt says nothing about it.
          </li>
          <li>
            <span className="text-fg">noindex and nosnippet</span> in meta tags and the X-Robots-Tag
            header, including rules aimed at a single bot.
          </li>
          <li>
            <span className="text-fg">Content without JavaScript.</span> Most AI crawlers read the HTML
            and never run scripts. A client-rendered page can look perfect in a browser and be empty to
            them.{" "}
            <Link href="/lab/ai-crawler" className="text-fg underline decoration-accent/50 underline-offset-4 hover:decoration-accent">
              The rendering test
            </Link>{" "}
            logs which ones do run it.
          </li>
          <li>
            <span className="text-fg">Supporting signals:</span> title, description, H1, structured
            data, canonical and sitemap.
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-faint">
          Training crawlers are scored lightly. Opting out of model training is a legitimate choice, and it
          does not keep a site out of AI search answers; blocking the search and user-triggered fetchers
          does. Nothing you check here is stored.
        </p>
      </section>

      <section className="rise mt-16 border-t border-line pt-8" style={stagger(3)}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
            More from the Lab
          </h2>
          <Link
            href="/lab"
            className="group inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
          >
            All experiments
            <ArrowIcon className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-4">
          <Link
            href="/lab/ai-crawler"
            className="group block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-fg/20"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium text-fg">AI Crawler Rendering Test</h3>
              <ArrowIcon className="size-3.5 text-muted transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-fg" />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              A live test page and real-time edge log that measures which AI bots execute JavaScript vs. reading raw HTML.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
