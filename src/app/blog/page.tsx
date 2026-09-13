import PostList from "@/components/post-list";
import { stagger } from "@/lib/motion";
import { getAllPosts, type Post } from "@/lib/posts";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta({
  title: "Blog",
  description:
    "Notes on technical SEO, crawlers, and how pages get into AI answers, written by a software engineer while building SEORCE.",
  path: "/blog",
});

export default function BlogPage() {
  const byYear = Map.groupBy(getAllPosts(), (post: Post) => post.date.slice(0, 4));

  return (
    <div className="mx-auto max-w-2xl pt-24 sm:pt-32">
      <header className="rise">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Blog</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Notes from building.</h1>
        <p className="mt-4 max-w-lg text-lg text-pretty text-muted">
          What I&apos;m learning about search, crawlers, and AI answers from a software engineering background. Honest
          notes, not expert cosplay.
        </p>
      </header>

      {[...byYear].map(([year, posts], index) => (
        <section key={year} aria-labelledby={`year-${year}`} className="rise mt-16" style={stagger(index + 1)}>
          <h2 id={`year-${year}`} className="mb-3 font-mono text-xs text-muted">
            {year}
          </h2>
          <PostList posts={posts} />
        </section>
      ))}
    </div>
  );
}
