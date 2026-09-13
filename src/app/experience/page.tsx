import { education, work, type Entry } from "@/content/experience";
import { stagger } from "@/lib/motion";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Experience",
  description:
    "Johnpaul Nnaji's experience: software engineer at SEORCE, lead backend engineer at myBigshelf, and computer science at Nnamdi Azikiwe University.",
  path: "/experience",
});

function Timeline({ id, label, entries, index }: { id: string; label: string; entries: Entry[]; index: number }) {
  return (
    <section aria-labelledby={id} className="rise mt-16" style={stagger(index)}>
      <h2 id={id} className="mb-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">
        {label}
      </h2>
      <ol className="border-t border-line">
        {entries.map((entry) => (
          <li key={`${entry.org}-${entry.start}`} className="grid gap-2 border-b border-line py-8 sm:grid-cols-[10rem_1fr] sm:gap-8">
            <p className="font-mono text-xs text-muted sm:pt-1.5">
              <time dateTime={entry.start}>{entry.period}</time>
            </p>
            <div>
              <h3 className="text-lg font-medium tracking-[-0.01em]">
                {entry.title} <span className="text-muted">· {entry.org}</span>
              </h3>
              <div className="mt-3 space-y-3 leading-relaxed text-pretty text-muted">
                {entry.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function ExperiencePage() {
  return (
    <div className="mx-auto max-w-2xl pt-24 sm:pt-32">
      <header className="rise">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Experience</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
          School, jobs, and the work that stuck.
        </h1>
      </header>
      <Timeline id="work" label="Work" entries={work} index={1} />
      <Timeline id="education" label="Education" entries={education} index={2} />
    </div>
  );
}
