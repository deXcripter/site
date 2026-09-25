import Link from "next/link";
import { ArrowIcon } from "@/components/icons";
import { labTools } from "@/content/lab";
import { stagger } from "@/lib/motion";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Lab",
  description:
    "Interactive tools, benchmarks, and experiments exploring technical SEO, crawler behavior, and how search and AI engines see the web.",
  path: "/lab",
});

export default function LabPage() {
  return (
    <div className="mx-auto max-w-2xl pt-24 sm:pt-32">
      <header className="rise">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Lab</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
          Experiments & Tools
        </h1>
        <p className="mt-4 max-w-lg text-lg text-pretty text-muted">
          Interactive tools, benchmarks, and live tests exploring technical SEO, crawler behavior, and how AI engines and search bots read the web.
        </p>
      </header>

      <div className="rise mt-12 space-y-6" style={stagger(1)}>
        {labTools.map((tool, index) => (
          <article
            key={tool.slug}
            className="group relative rounded-3xl bg-surface p-6 ring-1 ring-line transition-all duration-300 hover:ring-fg/30 sm:p-8"
            style={stagger(index + 1)}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-muted uppercase tracking-[0.1em]">
                  {tool.badge}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[11px] text-accent">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  {tool.status}
                </span>
              </div>
              <Link
                href={tool.href}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors group-hover:text-fg"
              >
                Open tool
                <ArrowIcon className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em]">
              <Link href={tool.href} className="transition-colors hover:text-accent">
                {tool.title}
              </Link>
            </h2>
            <p className="mt-1 font-mono text-xs text-muted">{tool.tagline}</p>
            <p className="mt-3 text-base leading-relaxed text-pretty text-muted">
              {tool.description}
            </p>

            <ul className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              {tool.highlights.map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-bg/60 px-3 py-1 font-mono text-xs text-muted ring-1 ring-line"
                >
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
