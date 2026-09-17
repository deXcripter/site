import Link from "next/link";
import JsonLd from "@/components/json-ld";
import { stagger } from "@/lib/motion";
import { pageMeta, personId, site } from "@/lib/site";

export const metadata = pageMeta({
  title: "About",
  description:
    "Johnpaul Nnaji is a software engineer building SEORCE, working on technical SEO, crawl analytics, and generative engine optimization (GEO).",
  path: "/about",
});

const currently = [
  {
    title: "Building SEORCE",
    body: "SEORCE helps brands see how they show up in Google, Bing, and AI search tools like ChatGPT, Perplexity, and Gemini. A big part of that is generative engine optimization (GEO): whether and how you get mentioned in AI answers.",
  },
  {
    title: "Learning technical SEO",
    body: "Working through crawl budget, structured data, and how LLMs find and cite pages. I write up what I figure out on the blog.",
  },
  {
    title: "Writing as I go",
    body: "Short posts on what I'm learning about SEO from a software engineering background.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl pt-24 sm:pt-32">
      <header className="rise">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">About</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          Software engineer, learning SEO, building SEORCE.
        </h1>
      </header>

      <div className="rise mt-10 space-y-5 text-lg leading-relaxed text-pretty text-muted" style={stagger(1)}>
        <p>
          <span className="text-fg">Johnpaul Nnaji is a software engineer</span> building tools that help brands show up
          better in Google and in AI search (ChatGPT, Perplexity, and similar). Right now he works on SEORCE, a product for
          tracking how brands appear across those surfaces.
        </p>
        <p>
          He graduated with a computer science degree from Nnamdi Azikiwe University in 2025, then joined SEORCE. Day to
          day that means technical SEO, crawl work, and analytics around how AI systems pull and cite web content. The
          overlapping interest is SEO, AI, and generative engine optimization (GEO): how pages get into AI answers in the
          first place.
        </p>
        <p>
          He writes while he learns. Posts are notes from building, not polished lectures from someone with ten years in
          the field.{" "}
          <Link href="/blog" className="text-fg underline decoration-accent/50 underline-offset-4 hover:decoration-accent">
            Read the blog
          </Link>
          .
        </p>
      </div>

      <section aria-labelledby="currently" className="rise mt-20" style={stagger(2)}>
        <h2 id="currently" className="text-2xl font-semibold tracking-[-0.025em]">
          What does Johnpaul Nnaji do?
        </h2>
        <ul className="mt-6 border-t border-line">
          {currently.map((item) => (
            <li key={item.title} className="grid gap-2 border-b border-line py-6 sm:grid-cols-[12rem_1fr] sm:gap-8">
              <h3 className="font-medium">{item.title}</h3>
              <p className="leading-relaxed text-pretty text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="elsewhere" className="rise mt-20" style={stagger(3)}>
        <h2 id="elsewhere" className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
          Elsewhere
        </h2>
        <p className="mt-4 text-lg text-muted">
          I&apos;m <span className="text-fg">@{site.handle}</span> on{" "}
          {site.socials.map(({ label, href }, i) => (
            <span key={label}>
              <a href={href} target="_blank" rel="me noopener noreferrer" className="text-fg underline decoration-line underline-offset-4 transition-colors hover:decoration-accent">
                {label}
              </a>
              {i < site.socials.length - 2 ? ", " : i === site.socials.length - 2 ? ", and " : "."}
            </span>
          ))}
        </p>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: `${site.url}/about`,
          name: `About ${site.name}`,
          mainEntity: { "@id": personId },
        }}
      />
    </div>
  );
}
