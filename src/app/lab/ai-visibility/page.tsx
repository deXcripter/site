import Link from "next/link";
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
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Lab</p>
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
    </div>
  );
}
