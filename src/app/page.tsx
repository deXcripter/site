import Link from "next/link";
import Avatar from "@/components/avatar";
import { ArrowIcon, GitHubIcon, LinkedInIcon, XIcon } from "@/components/icons";
import PostList from "@/components/post-list";
import { projects, work } from "@/content/experience";
import { stagger } from "@/lib/motion";
import { getAllPosts } from "@/lib/posts";
import { pageMeta, site } from "@/lib/site";

export const metadata = pageMeta({ description: site.description, path: "/" });

const tiles = [
  { label: "GitHub", href: "https://github.com/dexcripter", Icon: GitHubIcon },
  { label: "X", href: "https://x.com/dexcripter", Icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com/in/dexcripter", Icon: LinkedInIcon },
];

const now = [
  {
    title: "Building SEORCE",
    body: "Helping brands see how they show up in Google, Bing, and AI search tools like ChatGPT, Perplexity, and Gemini.",
  },
  {
    title: "Learning technical SEO",
    body: "Working through crawl budget, structured data, and how LLMs find and cite pages.",
  },
  {
    title: "Writing as I go",
    body: "Short posts on what I'm learning about SEO from a software engineering background.",
  },
];

function SectionHeading({ id, children, href, linkLabel }: { id: string; children: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="font-mono text-xs tracking-[0.14em] text-muted uppercase">
        {children}
      </h2>
      {href && (
        <Link href={href} className="group inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
          {linkLabel}
          <ArrowIcon className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export default function Home() {
  const posts = getAllPosts().slice(0, 4);

  return (
    <div className="mx-auto max-w-2xl">
      <section className="pt-24 sm:pt-36">
        <div className="rise flex items-center gap-4">
          <Avatar />
          <p className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative size-2 rounded-full bg-accent" />
            </span>
            Currently building SEORCE
          </p>
        </div>
        <h1 className="rise mt-7 text-[3.25rem] leading-[0.95] font-semibold tracking-[-0.05em] sm:text-7xl" style={stagger(1)}>
          Johnpaul Nnaji
        </h1>
        <p className="rise mt-6 max-w-xl text-xl leading-snug text-pretty text-muted sm:text-2xl" style={stagger(2)}>
          Software engineer building tools that help brands show up in <span className="text-fg">Google</span> and in{" "}
          <span className="text-fg">AI search</span>. I write honest notes on what I learn along the way.
        </p>
        <ul className="rise mt-10 flex gap-3" style={stagger(3)}>
          {tiles.map(({ label, href, Icon }) => (
            <li key={label}>
              <a
                href={href}
                aria-label={label}
                {...(href.startsWith("http") ? { target: "_blank", rel: "me noopener noreferrer" } : {})}
                className="glass grid size-12 place-items-center rounded-[15px] transition-transform duration-500 ease-soft hover:-translate-y-1 active:scale-95"
              >
                <Icon className="size-5" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="now" className="rise mt-24 sm:mt-32" style={stagger(4)}>
        <SectionHeading id="now" href="/about" linkLabel="About me">
          Now
        </SectionHeading>
        <ul className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {now.map((item) => (
            <li key={item.title} className="bg-bg p-5">
              <h3 className="text-[15px] font-medium">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="work" className="mt-24 sm:mt-32">
        <SectionHeading id="work">Selected work</SectionHeading>
        <div className="mt-5 space-y-4">
          {projects.map((project) => (
            <article key={project.name} className="rounded-3xl bg-surface p-6 ring-1 ring-line sm:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-2xl font-semibold tracking-[-0.03em]">{project.name}</h3>
                <p className="font-mono text-xs text-muted">{project.period}</p>
              </div>
              <p className="mt-3 text-pretty text-muted">{project.summary}</p>
              <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
                {project.details.map((detail) => (
                  <div key={detail.label}>
                    <dt className="font-mono text-xs text-muted">{detail.label}</dt>
                    <dd className="mt-1 text-pretty">{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="experience" className="mt-24 sm:mt-32">
        <SectionHeading id="experience" href="/experience" linkLabel="Full experience">
          Experience
        </SectionHeading>
        <ul className="mt-5 border-t border-line">
          {work.map((role) => (
            <li key={role.org} className="flex items-baseline justify-between gap-4 border-b border-line py-4">
              <p>
                <span className="font-medium">{role.title}</span>
                <span className="text-muted"> · {role.org}</span>
              </p>
              <p className="shrink-0 font-mono text-xs text-muted">{role.period}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="writing" className="mt-24 sm:mt-32">
        <SectionHeading id="writing" href="/blog" linkLabel="All posts">
          Writing
        </SectionHeading>
        <div className="mt-5">
          <PostList posts={posts} />
        </div>
      </section>
    </div>
  );
}
